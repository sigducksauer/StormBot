"""
apps/api/services/delivery_service.py
Entrega automática de produtos — DM, cargo, canal, webhook
Após entrega, notifica o bot para logar a venda e aciona o push de confirmação.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from packages.database.models import (
    Order, OrderItem, Product, ProductType, ProductKey,
    OrderStatus, Customer, Server,
)

log = logging.getLogger("delivery")

BOT_INTERNAL_URL    = os.getenv("BOT_INTERNAL_URL", "http://bot:3001")
API_INTERNAL_SECRET = os.getenv("API_INTERNAL_SECRET", "")


class DeliveryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def deliver(self, order: Order) -> bool:
        if order.status == OrderStatus.DELIVERED:
            log.warning(f"Pedido {order.id} já entregue.")
            return True

        result = await self.db.execute(
            select(OrderItem, Product)
            .join(Product, OrderItem.product_id == Product.id)
            .where(OrderItem.order_id == order.id)
        )
        rows = result.all()

        success = True
        for item, product in rows:
            try:
                ok = await self._deliver_item(order, item, product)
                if not ok:
                    success = False
            except Exception as e:
                log.error(f"Erro entregando item {item.id}: {e}")
                success = False

        if success:
            order.status       = OrderStatus.DELIVERED
            order.delivered_at = datetime.utcnow()
            await self.db.commit()
            log.info(f"[DELIVERY] Pedido {order.id} entregue.")

            # Notifica o bot: push de confirmação ao usuário do Discord + log no canal
            await self._notify_bot("payment_confirmed", {
                "order_id": order.id,
                "status":   "delivered",
            })
            await self._log_sale(order, rows[0][1] if rows else None)

        return success

    # ── Roteador de tipo de produto ──────────────────────────
    async def _deliver_item(self, order: Order, item: OrderItem, product: Product) -> bool:
        ptype = product.product_type
        if ptype == ProductType.KEY:     return await self._deliver_key(order, product)
        if ptype == ProductType.DIGITAL: return await self._deliver_digital(order, product)
        if ptype == ProductType.ROLE:    return await self._deliver_role(order, product)
        if ptype == ProductType.CHANNEL: return await self._deliver_channel(order, product)
        if ptype == ProductType.WEBHOOK: return await self._deliver_webhook(order, product)
        log.warning(f"Tipo desconhecido: {ptype}")
        return False

    # ── Chave / Serial ───────────────────────────────────────
    async def _deliver_key(self, order: Order, product: Product) -> bool:
        result = await self.db.execute(
            select(ProductKey).where(
                and_(ProductKey.product_id == product.id, ProductKey.is_used == False)
            ).limit(1)
        )
        key = result.scalar_one_or_none()
        if not key:
            log.error(f"Sem chaves para produto {product.id}")
            return False

        key.is_used  = True
        key.used_at  = datetime.utcnow()
        key.order_id = order.id

        discord_id = await self._customer_discord_id(order)
        await self._notify_bot("send_dm", {
            "discord_id":   str(discord_id),
            "type":         "key_delivery",
            "product_name": product.name,
            "key_value":    key.key_value,
            "order_id":     order.id,
        })
        return True

    # ── Arquivo Digital ──────────────────────────────────────
    async def _deliver_digital(self, order: Order, product: Product) -> bool:
        meta     = product.metadata_ or {}
        file_url = meta.get("file_url")
        if not file_url:
            log.error(f"Produto {product.id} sem file_url")
            return False

        discord_id = await self._customer_discord_id(order)
        await self._notify_bot("send_dm", {
            "discord_id":   str(discord_id),
            "type":         "digital_delivery",
            "product_name": product.name,
            "file_url":     file_url,
            "order_id":     order.id,
        })
        return True

    # ── Cargo Discord ────────────────────────────────────────
    async def _deliver_role(self, order: Order, product: Product) -> bool:
        meta    = product.metadata_ or {}
        role_id = meta.get("role_id")
        if not role_id:
            log.error(f"Produto {product.id} sem role_id")
            return False

        server   = await self.db.get(Server, order.server_id)
        guild_id = str(server.discord_id) if server else ""
        discord_id = await self._customer_discord_id(order)

        await self._notify_bot("give_role", {
            "guild_id":    guild_id,
            "discord_id":  str(discord_id),
            "role_id":     str(role_id),
            "duration_days": meta.get("duration_days"),
            "order_id":    order.id,
        })
        # Confirma por DM
        await self._notify_bot("send_dm", {
            "discord_id":   str(discord_id),
            "type":         "role_delivery",
            "product_name": product.name,
            "order_id":     order.id,
        })
        return True

    # ── Canal Discord ────────────────────────────────────────
    async def _deliver_channel(self, order: Order, product: Product) -> bool:
        meta       = product.metadata_ or {}
        channel_id = meta.get("channel_id")
        if not channel_id:
            return False

        server     = await self.db.get(Server, order.server_id)
        guild_id   = str(server.discord_id) if server else ""
        discord_id = await self._customer_discord_id(order)

        await self._notify_bot("grant_channel", {
            "guild_id":   guild_id,
            "discord_id": str(discord_id),
            "channel_id": str(channel_id),
            "order_id":   order.id,
        })
        return True

    # ── Webhook externo ──────────────────────────────────────
    async def _deliver_webhook(self, order: Order, product: Product) -> bool:
        meta        = product.metadata_ or {}
        webhook_url = meta.get("webhook_url")
        if not webhook_url:
            return False

        discord_id = await self._customer_discord_id(order)
        payload = {
            "event":      "order.delivered",
            "order_id":   order.id,
            "product_id": str(product.id),
            "discord_id": discord_id,
            "product":    product.name,
            "total":      order.total,
            "server_id":  str(order.server_id),
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                resp.raise_for_status()
            return True
        except Exception as e:
            log.error(f"Webhook delivery failed: {e}")
            return False

    # ── Log de venda no canal do servidor ─────────────────────
    async def _log_sale(self, order: Order, product: Optional[Product]) -> None:
        server = await self.db.get(Server, order.server_id)
        if not server:
            return
        settings       = server.settings or {}
        log_channel_id = settings.get("log_channel_id")

        customer = await self.db.get(Customer, order.customer_id)

        await self._notify_bot("log_sale", {
            "guild_id":       str(server.discord_id),
            "log_channel_id": log_channel_id,
            "customer_username": customer.username if customer else "Desconhecido",
            "product_name":   product.name if product else "Produto",
            "total":          order.total,
            "order_id":       order.id,
        })

    # ── HTTP helper ───────────────────────────────────────────
    async def _notify_bot(self, action: str, data: dict) -> None:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{BOT_INTERNAL_URL}/internal/{action}",
                    json=data,
                    headers={"X-Internal-Secret": API_INTERNAL_SECRET},
                )
        except Exception as e:
            log.error(f"Erro ao notificar bot ({action}): {e}")

    async def _customer_discord_id(self, order: Order) -> Optional[int]:
        customer = await self.db.get(Customer, order.customer_id)
        return customer.discord_id if customer else None
