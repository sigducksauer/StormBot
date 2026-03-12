"""
apps/api/routers/webhooks.py
Webhooks de saída — notificações de eventos para URLs externas
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import List, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import WebhookConfig

router = APIRouter()
log = logging.getLogger("webhooks")

VALID_EVENTS = [
    "order.paid", "order.delivered", "order.refunded",
    "order.expired", "order.failed", "product.low_stock",
]


class WebhookCreate(BaseModel):
    url:    str
    events: List[str] = ["order.paid"]
    secret: Optional[str] = None


@router.get("/")
async def list_webhooks(
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookConfig).where(WebhookConfig.server_id == server.id)
    )
    return [_serialize(w) for w in result.scalars().all()]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Eventos inválidos: {invalid}")

    wh = WebhookConfig(
        id=str(uuid4()),
        server_id=server.id,
        url=body.url,
        events=body.events,
        secret=body.secret,
    )
    db.add(wh)
    await db.commit()
    return _serialize(wh)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    wh = await db.get(WebhookConfig, webhook_id)
    if not wh or wh.server_id != server.id:
        raise HTTPException(status_code=404, detail="Webhook não encontrado.")
    await db.delete(wh)
    await db.commit()


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    wh = await db.get(WebhookConfig, webhook_id)
    if not wh or wh.server_id != server.id:
        raise HTTPException(status_code=404, detail="Webhook não encontrado.")

    payload = {"event": "test", "server_id": server.id, "message": "Teste do VendBot!"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(wh.url, json=payload)
            resp.raise_for_status()
        return {"success": True, "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Dispatcher interno (chamado pelo celery/services) ────────
async def dispatch_event(db: AsyncSession, server_id: str, event: str, data: dict) -> None:
    result = await db.execute(
        select(WebhookConfig).where(
            WebhookConfig.server_id == server_id,
            WebhookConfig.is_active == True,
        )
    )
    for wh in result.scalars().all():
        if event not in (wh.events or []):
            continue
        payload = {"event": event, "server_id": server_id, **data}
        headers = {"Content-Type": "application/json"}
        if wh.secret:
            sig = hmac.new(wh.secret.encode(), str(payload).encode(), hashlib.sha256).hexdigest()
            headers["X-VendBot-Signature"] = f"sha256={sig}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(wh.url, json=payload, headers=headers)
        except Exception as e:
            log.warning(f"Webhook dispatch falhou ({wh.url}): {e}")


def _serialize(w: WebhookConfig) -> dict:
    return {
        "id":         w.id,
        "url":        w.url,
        "events":     w.events or [],
        "is_active":  w.is_active,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }
