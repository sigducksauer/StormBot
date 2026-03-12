"""
apps/api/routers/payments.py
Webhooks de pagamento — Mercado Pago, Stripe, Pix Manual
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth import get_current_server
from services.payment_service import PaymentService
from services.order_service import OrderService
from services.delivery_service import DeliveryService

log = logging.getLogger("payments")
router = APIRouter()

MP_WEBHOOK_SECRET     = os.getenv("MP_WEBHOOK_SECRET", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
INTERNAL_SECRET       = os.getenv("API_INTERNAL_SECRET", "")


# ── Mercado Pago Webhook ─────────────────────────────────────
@router.post("/webhook/mercadopago")
async def mercadopago_webhook(
    request: Request,
    x_signature: str  = Header(None),
    x_request_id: str = Header(None),
    db: AsyncSession  = Depends(get_db),
):
    body = await request.body()

    if MP_WEBHOOK_SECRET:
        if not x_signature:
            raise HTTPException(status_code=401, detail="Assinatura ausente.")
        parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")
        manifest  = f"id:{x_request_id};ts:{ts};"
        expected  = hmac.new(MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(expected, v1):
            raise HTTPException(status_code=401, detail="Assinatura inválida.")

    data       = await request.json()
    event_type = data.get("type")
    log.info(f"[MP WEBHOOK] Evento: {event_type}")

    if event_type == "payment":
        payment_id = str(data.get("data", {}).get("id"))
        svc   = PaymentService(db)
        order = await svc.process_mercadopago_payment(payment_id)
        if order and order.status == "paid":
            await DeliveryService(db).deliver(order)

    return {"status": "ok"}


# ── Stripe Webhook ───────────────────────────────────────────
@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: AsyncSession      = Depends(get_db),
):
    body = await request.body()

    try:
        import stripe
        event = stripe.Webhook.construct_event(body, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    log.info(f"[STRIPE WEBHOOK] Evento: {event['type']}")

    svc = PaymentService(db)
    if event["type"] == "payment_intent.succeeded":
        order = await svc.process_stripe_payment(event["data"]["object"]["id"])
        if order:
            await DeliveryService(db).deliver(order)
    elif event["type"] == "payment_intent.payment_failed":
        await svc.mark_order_failed(event["data"]["object"]["id"])

    return {"status": "ok"}


# ── Pix Manual — confirmação pelo painel ────────────────────
@router.post("/pix/confirm/{order_id}")
async def confirm_pix_manual(
    order_id: str,
    request: Request,
    server=Depends(get_current_server),   # ← autenticação real via JWT/internal
    db: AsyncSession = Depends(get_db),
):
    """Confirma pagamento Pix manualmente. Requer autenticação do servidor."""
    svc   = PaymentService(db)
    order = await svc.confirm_pix_manual(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    if str(order.server_id) != str(server.id):
        raise HTTPException(status_code=403, detail="Sem permissão para este pedido.")

    await DeliveryService(db).deliver(order)
    return {"success": True, "order_id": order_id}


# ── Gerar cobrança Pix ───────────────────────────────────────
@router.post("/pix/generate")
async def generate_pix(
    order_id: str,
    server=Depends(get_current_server),   # ← autenticação obrigatória
    db: AsyncSession = Depends(get_db),
):
    """Gera QR code e código Pix para um pedido. Requer autenticação."""
    svc    = PaymentService(db)
    result = await svc.generate_pix(order_id, str(server.id))
    if not result:
        raise HTTPException(status_code=400, detail="Não foi possível gerar o Pix.")
    return result
