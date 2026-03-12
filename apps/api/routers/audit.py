"""
routers/audit.py — Logs de auditoria e notificações
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import AuditLog, NotificationConfig

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    action: Optional[str] = None,
    resource: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).where(AuditLog.server_id == server.id)
    if action:    q = q.where(AuditLog.action == action)
    if resource:  q = q.where(AuditLog.resource == resource)
    q = q.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(q)
    logs = res.scalars().all()
    return [
        {
            "id": str(l.id),
            "action": l.action,
            "resource": l.resource,
            "resource_id": l.resource_id,
            "changes": l.changes,
            "ip_address": l.ip_address,
            "created_at": str(l.created_at),
        }
        for l in logs
    ]


@router.get("/notifications")
async def get_notifications(server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NotificationConfig).where(NotificationConfig.server_id == server.id))
    return [
        {
            "id": str(n.id), "event": n.event, "channels": n.channels,
            "discord_channel_id": n.discord_channel_id,
            "email_to": n.email_to, "webhook_url": n.webhook_url,
            "is_active": n.is_active,
        }
        for n in res.scalars().all()
    ]


@router.put("/notifications/{event}")
async def upsert_notification(
    event: str, body: dict,
    server=Depends(get_current_server), db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(NotificationConfig).where(
            and_(NotificationConfig.server_id == server.id, NotificationConfig.event == event)
        )
    )
    n = res.scalar_one_or_none()
    if not n:
        n = NotificationConfig(server_id=server.id, event=event)
        db.add(n)
    for k, v in body.items():
        if hasattr(n, k): setattr(n, k, v)
    await db.commit()
    return {"ok": True}
