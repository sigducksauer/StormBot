"""
apps/api/services/order_service.py
Regras de negócio de pedidos — criação, taxa, reembolso
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from packages.database.models import (
    Order, OrderItem, OrderStatus, Customer, Product,
    ProductVariant, Coupon, Server, PaymentGateway, GatewayType
)
from services.payment_service import PaymentService

log = logging.getLogger("order_service")


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_order(
        self,
        server_id: str,
        customer_discord_id: int,
        customer_username: str,
        items: List[dict],
        coupon_code: Optional[str],
        payment_method: str,
        gateway: str,
    ) -> Order:
        # 1. Busca ou cria customer
        customer = await self._get_or_create_customer(
            server_id, customer_discord_id, customer_username
        )

        if customer.is_blacklisted:
            raise ValueError("Usuário está na blacklist e não pode comprar.")

        # 2. Busca servidor para calcular taxa
        server = await self.db.get(Server, server_id)
        if not server:
            raise ValueError("Servidor não encontrado.")

        # 3. Valida e monta itens
        order_items, subtotal = await self._build_items(items)

        # 4. Aplica cupom
        discount = 0.0
        coupon = None
        if coupon_code:
            coupon, discount = await self._apply_coupon(server_id, coupon_code, subtotal)

        total = max(subtotal - discount, 0.0)

        # 5. Calcula taxa VendBot
        fee_rate   = server.fee_rate
        fee_amount = round(total * fee_rate / 100, 2)
        net_amount = round(total - fee_amount, 2)

        # 6. Cria pedido
        order = Order(
            id=str(uuid4()),
            server_id=server_id,
            customer_id=customer.id,
            status=OrderStatus.PENDING,
            subtotal=subtotal,
            discount=discount,
            total=total,
            fee_rate=fee_rate,
            fee_amount=fee_amount,
            net_amount=net_amount,
            payment_method=payment_method,
            gateway=gateway,
            coupon_id=coupon.id if coupon else None,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
        self.db.add(order)
        await self.db.flush()

        # 7. Adiciona itens
        for item_data, product in order_items:
            item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                variant_id=item_data.get("variant_id"),
                quantity=item_data.get("quantity", 1),
                unit_price=product.price,
                total_price=product.price * item_data.get("quantity", 1),
            )
            self.db.add(item)
            # Decrementa estoque
            if product.stock > 0:
                product.stock -= item_data.get("quantity", 1)

        # 8. Incrementa uso do cupom
        if coupon:
            coupon.used_count += 1

        await self.db.flush()

        # 9. Gera cobrança no gateway
        payment_svc = PaymentService(self.db)
        payment_data = await payment_svc.create_charge(order, server)
        order.gateway_order_id = payment_data.get("gateway_order_id")
        order.metadata_ = payment_data

        log.info(f"[ORDER] Criado #{order.id} | R${total:.2f} | taxa={fee_rate}% | gateway={gateway}")
        return order

    async def get_order(self, order_id: str, server_id: str) -> Optional[Order]:
        result = await self.db.execute(
            select(Order).where(
                and_(Order.id == order_id, Order.server_id == server_id)
            )
        )
        return result.scalar_one_or_none()

    async def list_orders(
        self,
        server_id: str,
        status: Optional[str] = None,
        customer_discord_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Tuple[List[Order], int]:
        query = select(Order).where(Order.server_id == server_id)
        if status:
            query = query.where(Order.status == status)
        if customer_discord_id:
            customer_q = select(Customer.id).where(
                and_(
                    Customer.server_id == server_id,
                    Customer.discord_id == customer_discord_id,
                )
            )
            query = query.where(Order.customer_id.in_(customer_q))

        total_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(total_q)).scalar()

        query = query.order_by(Order.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def refund_order(self, order_id: str, server_id: str) -> dict:
        order = await self.get_order(order_id, server_id)
        if not order:
            return {"success": False, "error": "Pedido não encontrado."}
        if order.status != OrderStatus.PAID:
            return {"success": False, "error": "Só é possível reembolsar pedidos pagos."}

        payment_svc = PaymentService(self.db)
        try:
            await payment_svc.refund(order)
            order.status = OrderStatus.REFUNDED
            return {"success": True}
        except Exception as e:
            log.error(f"Erro no reembolso: {e}")
            return {"success": False, "error": str(e)}

    async def mark_paid(self, order_id: str) -> Optional[Order]:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if order and order.status == OrderStatus.PENDING:
            order.status = OrderStatus.PAID
            order.paid_at = datetime.utcnow()
            # Atualiza stats do customer
            customer = await self.db.get(Customer, order.customer_id)
            if customer:
                customer.total_spent += order.total
                customer.order_count += 1
        return order

    # ── Helpers privados ────────────────────────────────────
    async def _get_or_create_customer(
        self, server_id: str, discord_id: int, username: str
    ) -> Customer:
        result = await self.db.execute(
            select(Customer).where(
                and_(Customer.server_id == server_id, Customer.discord_id == discord_id)
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            customer = Customer(
                id=str(uuid4()),
                server_id=server_id,
                discord_id=discord_id,
                username=username,
            )
            self.db.add(customer)
            await self.db.flush()
        return customer

    async def _build_items(self, items: List[dict]) -> Tuple[list, float]:
        result_items = []
        subtotal = 0.0
        for item in items:
            product = await self.db.get(Product, item["product_id"])
            if not product or not product.is_active:
                raise ValueError(f"Produto {item['product_id']} não encontrado ou inativo.")
            if product.stock == 0:
                raise ValueError(f"Produto '{product.name}' está sem estoque.")
            qty = item.get("quantity", 1)
            subtotal += product.price * qty
            result_items.append((item, product))
        return result_items, round(subtotal, 2)

    async def _apply_coupon(
        self, server_id: str, code: str, subtotal: float
    ) -> Tuple[Optional[Coupon], float]:
        result = await self.db.execute(
            select(Coupon).where(
                and_(
                    Coupon.server_id == server_id,
                    Coupon.code == code.upper(),
                    Coupon.is_active == True,
                )
            )
        )
        coupon = result.scalar_one_or_none()
        if not coupon:
            raise ValueError(f"Cupom '{code}' inválido ou expirado.")
        if coupon.expires_at and coupon.expires_at < datetime.utcnow():
            raise ValueError("Cupom expirado.")
        if coupon.max_uses != -1 and coupon.used_count >= coupon.max_uses:
            raise ValueError("Cupom atingiu o limite de usos.")
        if subtotal < coupon.min_purchase:
            raise ValueError(f"Valor mínimo para este cupom: R${coupon.min_purchase:.2f}")

        if coupon.discount_type == "percent":
            discount = round(subtotal * coupon.discount_value / 100, 2)
        else:
            discount = min(coupon.discount_value, subtotal)

        return coupon, discount
