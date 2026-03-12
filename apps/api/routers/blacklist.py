"""
routers/blacklist.py — Sistema anti-fraude e blacklist
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Blacklist

router = APIRouter()


class BlacklistAdd(BaseModel):
    discord_id: Optional[int] = None
    ip_address: Optional[str] = None
    email: Optional[str] = None
    reason: Optional[str] = None


@router.get("/")
async def list_blacklist(server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Blacklist).where(Blacklist.server_id == server.id).order_by(Blacklist.created_at.desc()))
    return [{"id": str(b.id), "discord_id": b.discord_id, "ip_address": b.ip_address, "email": b.email, "reason": b.reason, "created_at": str(b.created_at)} for b in res.scalars().all()]


@router.post("/", status_code=201)
async def add_to_blacklist(body: BlacklistAdd, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    b = Blacklist(server_id=server.id, discord_id=body.discord_id, ip_address=body.ip_address, email=body.email, reason=body.reason)
    db.add(b); await db.commit(); await db.refresh(b)
    return {"id": str(b.id)}


@router.delete("/{entry_id}", status_code=204)
async def remove_from_blacklist(entry_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    b = await db.get(Blacklist, entry_id)
    if not b or b.server_id != server.id: raise HTTPException(404)
    await db.delete(b); await db.commit()


@router.post("/check")
async def check_blacklist(body: dict, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    """Bot calls this before creating an order."""
    conditions = []
    if body.get("discord_id"):
        conditions.append(Blacklist.discord_id == body["discord_id"])
    if body.get("ip_address"):
        conditions.append(Blacklist.ip_address == body["ip_address"])
    if body.get("email"):
        conditions.append(Blacklist.email == body["email"])
    if not conditions:
        return {"is_blocked": False}
    res = await db.execute(select(Blacklist).where(and_(Blacklist.server_id == server.id, or_(*conditions))))
    entry = res.scalar_one_or_none()
    return {"is_blocked": bool(entry), "reason": entry.reason if entry else None}
