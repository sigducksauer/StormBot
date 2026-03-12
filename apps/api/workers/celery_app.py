"""
apps/api/workers/celery_app.py
Tarefas assíncronas com Celery — expiração de pedidos, alertas de estoque,
notificações, renovação de planos
"""
from __future__ import annotations

import logging
import os

from celery import Celery
from celery.schedules import crontab

log = logging.getLogger("celery")

BROKER  = os.getenv("CELERY_BROKER_URL",  "redis://redis:6379/1")
BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2")

celery_app = Celery("vendbot", broker=BROKER, backend=BACKEND)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# ── Tarefas periódicas ────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Expira pedidos Pix não pagos a cada 2 minutos
    "expire-pending-orders": {
        "task":     "workers.tasks.expire_pending_orders",
        "schedule": 120,  # segundos
    },
    # Verifica estoque baixo a cada hora
    "check-low-stock": {
        "task":     "workers.tasks.check_low_stock",
        "schedule": crontab(minute=0),  # a cada hora
    },
    # Relatório diário de vendas para donos de servidor
    "daily-sales-report": {
        "task":     "workers.tasks.send_daily_reports",
        "schedule": crontab(hour=8, minute=0),  # 8h por dia
    },
}


# ── Tarefas ───────────────────────────────────────────────────
@celery_app.task(name="workers.tasks.expire_pending_orders", bind=True, max_retries=3)
def expire_pending_orders(self):
    """Marca como expirados os pedidos Pix não pagos após 15 minutos."""
    import asyncio
    from datetime import datetime

    async def _run():
        from database import AsyncSessionLocal
        from packages.database.models import Order, OrderStatus
        from sqlalchemy import select, and_

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Order).where(
                    and_(
                        Order.status == OrderStatus.PENDING,
                        Order.expires_at <= datetime.utcnow(),
                    )
                )
            )
            orders = result.scalars().all()
            for order in orders:
                order.status = OrderStatus.EXPIRED
                log.info(f"[EXPIRY] Pedido {order.id} expirado")
            await db.commit()
            return len(orders)

    count = asyncio.run(_run())
    log.info(f"[EXPIRY] {count} pedidos expirados")
    return count


@celery_app.task(name="workers.tasks.check_low_stock", bind=True)
def check_low_stock(self):
    """Notifica vendedores sobre produtos com estoque baixo."""
    import asyncio

    async def _run():
        from database import AsyncSessionLocal
        from packages.database.models import Product, Server
        from sqlalchemy import select, and_

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Product).where(
                    and_(
                        Product.stock >= 0,
                        Product.stock <= Product.stock_alert,
                        Product.is_active == True,
                    )
                )
            )
            products = result.scalars().all()

            for product in products:
                log.warning(f"[LOW STOCK] Produto '{product.name}' | estoque={product.stock}")
                # TODO: enviar notificação Discord ao dono do servidor
            return len(products)

    count = asyncio.run(_run())
    return count


@celery_app.task(name="workers.tasks.send_daily_reports")
def send_daily_reports():
    """Envia resumo diário de vendas para os donos de servidor."""
    import asyncio

    async def _run():
        from database import AsyncSessionLocal
        from packages.database.models import Order, OrderStatus, Server
        from sqlalchemy import select, func, and_
        from datetime import datetime, timedelta

        yesterday = datetime.utcnow() - timedelta(days=1)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(
                    Order.server_id,
                    func.count(Order.id).label("orders"),
                    func.sum(Order.net_amount).label("revenue"),
                ).where(
                    and_(
                        Order.status == OrderStatus.PAID,
                        Order.paid_at >= yesterday,
                    )
                ).group_by(Order.server_id)
            )
            rows = result.all()
            for row in rows:
                log.info(f"[DAILY] server={row.server_id} | pedidos={row.orders} | R${row.revenue:.2f}")
            return len(rows)

    return asyncio.run(_run())


@celery_app.task(name="workers.tasks.dispatch_webhook", bind=True, max_retries=5)
def dispatch_webhook(self, webhook_id: str, event: str, payload: dict):
    """Dispara webhook de saída com retry automático."""
    import asyncio
    import hashlib
    import hmac
    import json
    import httpx

    async def _run():
        from database import AsyncSessionLocal
        from packages.database.models import WebhookConfig

        async with AsyncSessionLocal() as db:
            wh = await db.get(WebhookConfig, webhook_id)
            if not wh or not wh.is_active:
                return

            headers = {"Content-Type": "application/json", "X-VendBot-Event": event}
            if wh.secret:
                sig = hmac.new(wh.secret.encode(), json.dumps(payload).encode(), hashlib.sha256).hexdigest()
                headers["X-VendBot-Signature"] = f"sha256={sig}"

            async with httpx.AsyncClient() as client:
                resp = await client.post(wh.url, json=payload, headers=headers, timeout=10)
                resp.raise_for_status()

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 30)
