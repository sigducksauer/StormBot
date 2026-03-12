"""
routers/automations.py — Sistema de automações e gatilhos
"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Automation, AutomationTrigger

router = APIRouter()

TRIGGER_LABELS = {
    "order_created":         "Pedido criado",
    "order_paid":            "Pagamento confirmado",
    "order_delivered":       "Pedido entregue",
    "order_expired":         "Pedido expirado / Carrinho abandonado",
    "cart_abandoned":        "Carrinho abandonado",
    "stock_low":             "Estoque baixo",
    "post_purchase":         "Pós-compra (mensagem de agradecimento)",
    "subscription_expiring": "Assinatura expirando",
    "promotion":             "Promoção programada",
}

ACTION_SCHEMA = {
    "dm": ["message"],
    "dm_product": ["message"],
    "give_role": ["role_id", "duration_days"],
    "remove_role": ["role_id"],
    "create_ticket": ["subject", "message"],
    "send_channel": ["channel_id", "message"],
    "webhook": ["url", "payload_json"],
    "apply_coupon": ["coupon_code"],
    "notify_staff": ["channel_id", "message"],
}


class AutomationCreate(BaseModel):
    name: str
    trigger: str
    conditions: Optional[dict] = {}
    actions: Optional[List[dict]] = []
    is_active: Optional[bool] = True


def _fmt(a: Automation) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "trigger": a.trigger,
        "trigger_label": TRIGGER_LABELS.get(a.trigger, a.trigger),
        "conditions": a.conditions,
        "actions": a.actions,
        "is_active": a.is_active,
        "run_count": a.run_count,
        "created_at": str(a.created_at),
    }


@router.get("/")
async def list_automations(server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Automation).where(Automation.server_id == server.id).order_by(Automation.created_at.desc()))
    return [_fmt(a) for a in res.scalars().all()]


@router.get("/triggers")
async def get_triggers():
    """Return available triggers and action types for frontend."""
    return {"triggers": TRIGGER_LABELS, "action_types": ACTION_SCHEMA}


@router.post("/", status_code=201)
async def create_automation(body: AutomationCreate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = Automation(
        server_id=server.id, name=body.name, trigger=body.trigger,
        conditions=body.conditions, actions=body.actions, is_active=body.is_active
    )
    db.add(a); await db.commit(); await db.refresh(a)
    return _fmt(a)


@router.put("/{auto_id}")
async def update_automation(auto_id: str, body: AutomationCreate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = await db.get(Automation, auto_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    a.name = body.name; a.trigger = body.trigger
    a.conditions = body.conditions; a.actions = body.actions; a.is_active = body.is_active
    await db.commit(); await db.refresh(a)
    return _fmt(a)


@router.patch("/{auto_id}/toggle")
async def toggle_automation(auto_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = await db.get(Automation, auto_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    a.is_active = not a.is_active
    await db.commit()
    return {"is_active": a.is_active}


@router.delete("/{auto_id}", status_code=204)
async def delete_automation(auto_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = await db.get(Automation, auto_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    await db.delete(a); await db.commit()
