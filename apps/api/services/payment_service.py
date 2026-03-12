"""
apps/api/services/payment_service.py
Orquestração de pagamentos — cria cobranças, processa webhooks, reembolsa
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from packages.database.models import (
    Order, OrderStatus, PaymentGateway, GatewayType, Server
)
from gateways.mercadopago import MercadoPagoGateway, StripeGateway, PixManualGateway

log = logging.getLogger("payment_service")


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Cria cobrança no gateway ─────────────────────────────
    async def create_charge(self, order: Order, server: Server) -> dict:
        gateway_type = order.gateway
        gw_config = await self._get_gateway_config(server.id, gateway_type)

        if gateway_type == GatewayType.MERCADOPAGO:
            mp = MercadoPagoGateway(self._decrypt(gw_config.credentials["access_token"]))
            if order.payment_method == "pix":
                result = await mp.create_pix(
                    order_id=order.id,
                    amount=order.total,
                    description=f"Pedido VendBot #{order.id[:8]}",
                    payer_email="comprador@vendbot.com.br",
                    payer_name="Comprador",
                )
            else:
                # Cartão — gera link de checkout MP
                result = {"gateway_order_id": None, "mp_url": f"https://www.mercadopago.com.br/checkout"}
            return result

        elif gateway_type == GatewayType.STRIPE:
            stripe = StripeGateway(self._decrypt(gw_config.credentials["secret_key"]))
            return await stripe.create_payment_intent(
                order_id=order.id,
                amount_brl=order.total,
                description=f"Pedido VendBot #{order.id[:8]}",
                customer_email="",
            )

        elif gateway_type == GatewayType.PIX_MANUAL:
            cfg = gw_config.config or {}
            pix = PixManualGateway(
                pix_key=cfg.get("pix_key", ""),
                pix_key_type=cfg.get("pix_key_type", "aleatoria"),
                merchant_name=cfg.get("merchant_name", "VendBot"),
                merchant_city=cfg.get("merchant_city", "Brasil"),
            )
            pix_code = pix.generate_pix_code(order.total, order.id[:8], f"Pedido #{order.id[:8]}")
            return {
                "gateway_order_id": f"pix_manual_{order.id}",
                "pix_code": pix_code,
                "pix_qr_url": None,
            }

        return {}

    # ── Processa webhook Mercado Pago ────────────────────────
    async def process_mercadopago_payment(self, mp_payment_id: str) -> Optional[Order]:
        """Busca pedido pelo ID do MP e atualiza status."""
        result = await self.db.execute(
            select(Order).where(Order.gateway_order_id == mp_payment_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            log.warning(f"[MP] Pedido não encontrado para payment_id={mp_payment_id}")
            return None

        # Busca dados do pagamento no MP
        server = await self.db.get(Server, order.server_id)
        gw_config = await self._get_gateway_config(server.id, GatewayType.MERCADOPAGO)
        if not gw_config:
            return None

        mp = MercadoPagoGateway(self._decrypt(gw_config.credentials["access_token"]))
        payment_data = await mp.get_payment(mp_payment_id)
        mp_status = payment_data.get("status")

        if mp_status == "approved" and order.status == OrderStatus.PENDING:
            from services.order_service import OrderService
            svc = OrderService(self.db)
            order = await svc.mark_paid(order.id)
            log.info(f"[MP] Pagamento aprovado | order={order.id}")

        elif mp_status in ("rejected", "cancelled"):
            order.status = OrderStatus.FAILED
            await self.db.commit()

        return order

    # ── Processa webhook Stripe ──────────────────────────────
    async def process_stripe_payment(self, payment_intent_id: str) -> Optional[Order]:
        result = await self.db.execute(
            select(Order).where(Order.gateway_order_id == payment_intent_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            return None

        if order.status == OrderStatus.PENDING:
            from services.order_service import OrderService
            svc = OrderService(self.db)
            order = await svc.mark_paid(order.id)

        return order

    # ── Confirma Pix manual ──────────────────────────────────
    async def confirm_pix_manual(self, order_id: str) -> Optional[Order]:
        order = await self.db.get(Order, order_id)
        if not order or order.status != OrderStatus.PENDING:
            return None

        from services.order_service import OrderService
        svc = OrderService(self.db)
        return await svc.mark_paid(order_id)

    # ── Reembolso ────────────────────────────────────────────
    async def refund(self, order: Order) -> None:
        if order.gateway == GatewayType.MERCADOPAGO and order.gateway_order_id:
            server = await self.db.get(Server, order.server_id)
            gw_config = await self._get_gateway_config(server.id, GatewayType.MERCADOPAGO)
            mp = MercadoPagoGateway(self._decrypt(gw_config.credentials["access_token"]))
            await mp.refund_payment(order.gateway_order_id)

        elif order.gateway == GatewayType.STRIPE and order.gateway_order_id:
            server = await self.db.get(Server, order.server_id)
            gw_config = await self._get_gateway_config(server.id, GatewayType.STRIPE)
            stripe = StripeGateway(self._decrypt(gw_config.credentials["secret_key"]))
            await stripe.refund(order.gateway_order_id)

    # ── Generate Pix ─────────────────────────────────────────
    async def generate_pix(self, order_id: str, server_id: str) -> Optional[dict]:
        order = await self.db.get(Order, order_id)
        if not order:
            return None
        server = await self.db.get(Server, server_id)
        return await self.create_charge(order, server)

    # ── Helpers ──────────────────────────────────────────────
    async def _get_gateway_config(self, server_id: str, gateway_type) -> Optional[PaymentGateway]:
        result = await self.db.execute(
            select(PaymentGateway).where(
                PaymentGateway.server_id == server_id,
                PaymentGateway.gateway_type == gateway_type,
                PaymentGateway.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    def _decrypt(self, value: str) -> str:
        import base64
        from cryptography.fernet import Fernet
        raw = os.getenv("SECRET_KEY", "changeme_32chars_pad_to_32bytes!!")[:32]
        key = base64.urlsafe_b64encode(raw.encode().ljust(32)[:32])
        return Fernet(key).decrypt(value.encode()).decode()

    def mark_order_failed(self, gateway_order_id: str):
        pass  # tratado no router de pagamentos
