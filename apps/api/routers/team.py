"""
routers/team.py — Gestão de equipe e permissões
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import TeamMember, ServerRole

router = APIRouter()

ROLE_PERMS = {
    ServerRole.OWNER:     {"all": True},
    ServerRole.ADMIN:     {"products": True, "orders": True, "customers": True, "analytics": True, "settings": True},
    ServerRole.SUPPORT:   {"orders": True, "tickets": True, "customers": True},
    ServerRole.MODERATOR: {"tickets": True},
}


class MemberInvite(BaseModel):
    discord_id: int
    username: str
    role: str
    permissions: Optional[dict] = None


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None


def _fmt(m: TeamMember) -> dict:
    return {
        "id": str(m.id),
        "discord_id": m.discord_id,
        "username": m.username,
        "role": m.role,
        "permissions": m.permissions,
        "is_active": m.is_active,
        "created_at": str(m.created_at),
    }


@router.get("/")
async def list_team(server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TeamMember).where(TeamMember.server_id == server.id))
    return [_fmt(m) for m in res.scalars().all()]


@router.post("/", status_code=201)
async def invite_member(body: MemberInvite, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    ex = await db.execute(select(TeamMember).where(and_(TeamMember.server_id == server.id, TeamMember.discord_id == body.discord_id)))
    if ex.scalar_one_or_none():
        raise HTTPException(400, "Membro já existe na equipe.")
    # default perms from role
    perms = body.permissions or ROLE_PERMS.get(body.role, {})
    m = TeamMember(server_id=server.id, discord_id=body.discord_id, username=body.username, role=body.role, permissions=perms)
    db.add(m); await db.commit(); await db.refresh(m)
    return _fmt(m)


@router.patch("/{member_id}")
async def update_member(member_id: str, body: MemberUpdate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    m = await db.get(TeamMember, member_id)
    if not m or m.server_id != server.id: raise HTTPException(404)
    if body.role: m.role = body.role
    if body.permissions is not None: m.permissions = body.permissions
    if body.is_active is not None: m.is_active = body.is_active
    await db.commit(); await db.refresh(m)
    return _fmt(m)


@router.delete("/{member_id}", status_code=204)
async def remove_member(member_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    m = await db.get(TeamMember, member_id)
    if not m or m.server_id != server.id: raise HTTPException(404)
    await db.delete(m); await db.commit()


@router.get("/roles")
async def get_roles():
    return {"roles": [
        {"key": "admin",     "label": "Admin",      "desc": "Acesso total exceto billing"},
        {"key": "support",   "label": "Suporte",    "desc": "Gerencia pedidos e tickets"},
        {"key": "moderator", "label": "Moderador",  "desc": "Só tickets"},
    ]}
