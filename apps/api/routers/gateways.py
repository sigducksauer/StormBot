"""
apps/api/routers/gateways.py
Configuração de gateways de pagamento por servidor
"""
from __future__ import annotations

import base64
import os
from typing import Optional
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import PaymentGateway, GatewayType, PlanType

router = APIRouter()

# Chave de criptografia para credenciais sensíveis
_RAW_KEY = os.getenv("SECRET_KEY", "changeme_32chars_pad_to_32bytes!!")[:32]
FERNET_KEY = base64.urlsafe_b64encode(_RAW_KEY.encode().ljust(32)[:32])
fernet = Fernet(FERNET_KEY)

PLAN_GATEWAYS = {
    PlanType.SIMPLES:    ["pix_manual"],
    PlanType.STANDARD:   ["mercadopago", "pix_manual"],
    PlanType.PREMIUM:    ["mercadopago", "pix_manual", "stripe"],
    PlanType.ENTERPRISE: ["mercadopago", "pix_manual", "stripe", "vendpay"],
}


# ── Schemas ──────────────────────────────────────────────────
class MercadoPagoConfig(BaseModel):
    access_token:  str
    public_key:    str
    webhook_secret: Optional[str] = None


class StripeConfig(BaseModel):
    secret_key:       str
    publishable_key:  str
    webhook_secret:   Optional[str] = None


class PixManualConfig(BaseModel):
    pix_key:       str
    pix_key_type:  str   # cpf, email, telefone, aleatoria
    merchant_name: str
    merchant_city: str


class GatewayToggle(BaseModel):
    is_active: bool


# ── Endpoints ────────────────────────────────────────────────
@router.get("/")
async def list_gateways(
    server_discord_id: Optional[int] = None,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Lista gateways configurados (sem expor credenciais)."""
    result = await db.execute(
        select(PaymentGateway).where(PaymentGateway.server_id == server.id)
    )
    gateways = result.scalars().all()
    return [_safe_serialize(g) for g in gateways]


@router.post("/mercadopago", status_code=status.HTTP_201_CREATED)
async def setup_mercadopago(
    body: MercadoPagoConfig,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    _check_plan(server, "mercadopago")
    return await _upsert_gateway(
        db, server.id, GatewayType.MERCADOPAGO,
        credentials={
            "access_token":  _encrypt(body.access_token),
            "public_key":    body.public_key,
            "webhook_secret": _encrypt(body.webhook_secret) if body.webhook_secret else None,
        },
    )


@router.post("/stripe", status_code=status.HTTP_201_CREATED)
async def setup_stripe(
    body: StripeConfig,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    _check_plan(server, "stripe")
    return await _upsert_gateway(
        db, server.id, GatewayType.STRIPE,
        credentials={
            "secret_key":      _encrypt(body.secret_key),
            "publishable_key": body.publishable_key,
            "webhook_secret":  _encrypt(body.webhook_secret) if body.webhook_secret else None,
        },
    )


@router.post("/pix-manual", status_code=status.HTTP_201_CREATED)
async def setup_pix_manual(
    body: PixManualConfig,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    gw = await _upsert_gateway(
        db, server.id, GatewayType.PIX_MANUAL,
        credentials={},
        extra={
            "pix_key":       body.pix_key,
            "pix_key_type":  body.pix_key_type,
            "merchant_name": body.merchant_name,
            "merchant_city": body.merchant_city,
        },
    )
    return gw


@router.patch("/{gateway_id}/toggle")
async def toggle_gateway(
    gateway_id: str,
    body: GatewayToggle,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    gw = await db.get(PaymentGateway, gateway_id)
    if not gw or gw.server_id != server.id:
        raise HTTPException(status_code=404, detail="Gateway não encontrado.")
    gw.is_active = body.is_active
    await db.commit()
    return {"success": True, "is_active": gw.is_active}


@router.delete("/{gateway_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gateway(
    gateway_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    gw = await db.get(PaymentGateway, gateway_id)
    if not gw or gw.server_id != server.id:
        raise HTTPException(status_code=404, detail="Gateway não encontrado.")
    await db.delete(gw)
    await db.commit()


# ── Helpers ──────────────────────────────────────────────────
def _check_plan(server, gateway_type: str):
    allowed = PLAN_GATEWAYS.get(server.plan, [])
    if gateway_type not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Gateway '{gateway_type}' não disponível no plano {server.plan}. Faça upgrade.",
        )


def _encrypt(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    return fernet.decrypt(value.encode()).decode()


async def _upsert_gateway(
    db: AsyncSession, server_id: str, gateway_type: GatewayType,
    credentials: dict, extra: dict = None
) -> dict:
    result = await db.execute(
        select(PaymentGateway).where(
            and_(
                PaymentGateway.server_id == server_id,
                PaymentGateway.gateway_type == gateway_type,
            )
        )
    )
    gw = result.scalar_one_or_none()

    if gw:
        gw.credentials = credentials
        if extra:
            gw.config = extra
        gw.is_active = True
    else:
        gw = PaymentGateway(
            id=str(uuid4()),
            server_id=server_id,
            gateway_type=gateway_type,
            credentials=credentials,
            config=extra or {},
            is_active=True,
        )
        db.add(gw)

    await db.commit()
    return _safe_serialize(gw)


def _safe_serialize(g: PaymentGateway) -> dict:
    return {
        "id":           g.id,
        "gateway_type": g.gateway_type,
        "is_active":    g.is_active,
        "pix_key":      g.config.get("pix_key") if g.config else None,
        "pix_key_type": g.config.get("pix_key_type") if g.config else None,
        "created_at":   g.created_at.isoformat() if g.created_at else None,
    }
