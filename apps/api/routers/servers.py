"""
apps/api/routers/servers.py
Gestão de servidores — onboarding, configurações, planos, claim
"""
from __future__ import annotations

import os
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from middleware.auth import get_current_user
from packages.database.models import Server, User, PlanType

router = APIRouter()

INTERNAL_SECRET  = os.getenv("API_INTERNAL_SECRET", "internal_secret")
NULL_OWNER       = "00000000-0000-0000-0000-000000000000"


class ServerSettingsUpdate(BaseModel):
    shop_channel_id:   Optional[int]   = None
    log_channel_id:    Optional[int]   = None
    order_role_id:     Optional[int]   = None
    welcome_message:   Optional[str]   = None
    currency_symbol:   Optional[str]   = None
    min_purchase:      Optional[float] = None
    purchase_cooldown: Optional[int]   = None


# ── Lista servidores do usuário (e faz auto-claim) ──────────
@router.get("/")
async def list_user_servers(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Auto-claim: busca servidores sem dono que pertencem a este discord_id
    unclaimed = await db.execute(
        select(Server).where(
            Server.owner_discord_id == user.discord_id,
            Server.owner_id == NULL_OWNER,
        )
    )
    for s in unclaimed.scalars().all():
        s.owner_id = user.id

    await db.commit()

    result = await db.execute(select(Server).where(Server.owner_id == user.id))
    servers = result.scalars().all()
    return {
        "servers": [
            {
                "id":         s.id,
                "discord_id": s.discord_id,
                "name":       s.name,
                "icon":       s.icon,
                "plan":       s.plan.value if hasattr(s.plan, "value") else s.plan,
                "is_active":  s.is_active,
            }
            for s in servers
        ]
    }


# ── Registro pelo bot ────────────────────────────────────────
@router.post("/register")
async def register_server(
    request: Request,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Segredo interno inválido.")

    body             = await request.json()
    guild_id         = int(body["guild_id"])
    guild_name       = body["guild_name"]
    guild_icon       = body.get("guild_icon")
    owner_discord_id = int(body.get("owner_id") or 0)

    # Verifica se já existe
    result = await db.execute(select(Server).where(Server.discord_id == guild_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.name = guild_name
        if guild_icon:
            existing.icon = guild_icon
        # Tenta resolver owner se ainda não resolvido
        if existing.owner_id == NULL_OWNER and owner_discord_id:
            r = await db.execute(select(User).where(User.discord_id == owner_discord_id))
            owner = r.scalar_one_or_none()
            if owner:
                existing.owner_id = owner.id
            else:
                existing.owner_discord_id = owner_discord_id
        await db.commit()
        return {"server_id": existing.id, "already_registered": True}

    # Tenta encontrar o dono pelo discord_id
    owner = None
    if owner_discord_id:
        r = await db.execute(select(User).where(User.discord_id == owner_discord_id))
        owner = r.scalar_one_or_none()

    server = Server(
        id=str(uuid4()),
        discord_id=guild_id,
        owner_id=owner.id if owner else NULL_OWNER,
        owner_discord_id=owner_discord_id or None,   # salva para claim posterior
        name=guild_name,
        icon=guild_icon,
        plan=PlanType.SIMPLES,
        settings={},
    )
    db.add(server)
    await db.commit()
    return {"server_id": server.id, "plan": PlanType.SIMPLES.value}


# ── Claim manual (caso auto-claim falhe) ─────────────────────
@router.post("/{guild_id}/claim")
async def claim_server(
    guild_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permite que o dono de um servidor sem owner o reivindique pelo discord_id."""
    result = await db.execute(select(Server).where(Server.discord_id == guild_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado.")
    if server.owner_id != NULL_OWNER:
        raise HTTPException(status_code=409, detail="Servidor já tem um dono.")
    if server.owner_discord_id and server.owner_discord_id != user.discord_id:
        raise HTTPException(status_code=403, detail="Você não é o dono deste servidor.")

    server.owner_id         = user.id
    server.owner_discord_id = user.discord_id
    await db.commit()
    return {"success": True, "server_id": server.id}


# ── Info pública (usada pelo bot) ────────────────────────────
@router.get("/{guild_id}/info")
async def get_server_info(
    guild_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Server).where(Server.discord_id == guild_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não registrado.")
    return {
        "id":         server.id,
        "discord_id": server.discord_id,
        "name":       server.name,
        "plan":       server.plan.value if hasattr(server.plan, "value") else server.plan,
        "fee_rate":   server.fee_rate,
        "is_active":  server.is_active,
        "settings":   server.settings or {},
    }


# ── Configurações ────────────────────────────────────────────
@router.get("/{server_id}/settings")
async def get_settings(
    server_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = await _owned(server_id, user.id, db)
    return {"settings": server.settings or {}}


@router.put("/{server_id}/settings")
async def update_settings(
    server_id: str,
    body: ServerSettingsUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = await _owned(server_id, user.id, db)
    current = dict(server.settings or {})
    current.update({k: v for k, v in body.model_dump().items() if v is not None})
    server.settings = current
    await db.commit()
    return {"success": True, "settings": server.settings}


# ── Plano ────────────────────────────────────────────────────
@router.get("/{server_id}/plan")
async def get_plan_info(
    server_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = await _owned(server_id, user.id, db)
    limits = {
        PlanType.SIMPLES:    {"products": 5,  "gateways": ["pix_manual"]},
        PlanType.STANDARD:   {"products": 30, "gateways": ["mercadopago", "pix_manual"]},
        PlanType.PREMIUM:    {"products": -1, "gateways": ["mercadopago", "pix_manual", "stripe"]},
        PlanType.ENTERPRISE: {"products": -1, "gateways": ["all"]},
    }
    return {
        "plan":     server.plan.value if hasattr(server.plan, "value") else server.plan,
        "fee_rate": server.fee_rate,
        "limits":   limits.get(server.plan, {}),
    }


# ── Upgrade de plano (chamado após pagamento confirmado) ─────
@router.post("/{server_id}/upgrade")
async def upgrade_plan(
    server_id: str,
    request: Request,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint interno chamado pelo serviço de pagamento após assinatura confirmada."""
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Não autorizado.")

    body = await request.json()
    new_plan = body.get("plan")
    try:
        plan_enum = PlanType(new_plan)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Plano inválido: {new_plan}")

    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado.")

    server.plan      = plan_enum
    server.is_active = True
    await db.commit()
    return {"success": True, "plan": plan_enum.value}


async def _owned(server_id: str, user_id: str, db: AsyncSession) -> Server:
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado.")
    if server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    return server
