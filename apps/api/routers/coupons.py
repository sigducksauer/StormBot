"""
apps/api/routers/coupons.py
Gestão de cupons de desconto
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Coupon, PlanType, Server

router = APIRouter()


class CouponCreate(BaseModel):
    code:          str
    discount_type: str          # "percent" ou "fixed"
    discount_value: float
    min_purchase:  float        = 0.0
    max_uses:      int          = -1
    expires_at:    Optional[datetime] = None

    @field_validator("code")
    @classmethod
    def upper_code(cls, v):
        return v.upper().strip()

    @field_validator("discount_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("percent", "fixed"):
            raise ValueError("Tipo deve ser 'percent' ou 'fixed'.")
        return v

    @field_validator("discount_value")
    @classmethod
    def positive_value(cls, v):
        if v <= 0:
            raise ValueError("Valor do desconto deve ser positivo.")
        return v


class ValidateCouponRequest(BaseModel):
    code:     str
    subtotal: float


@router.get("/")
async def list_coupons(
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Coupon).where(Coupon.server_id == server.id).order_by(Coupon.created_at.desc())
    )
    coupons = result.scalars().all()
    return [_serialize(c) for c in coupons]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_coupon(
    body: CouponCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    # Verifica plano
    if server.plan == PlanType.SIMPLES:
        raise HTTPException(
            status_code=403,
            detail="Cupons disponíveis a partir do plano Standard."
        )

    # Verifica duplicata
    existing = await db.execute(
        select(Coupon).where(
            and_(Coupon.server_id == server.id, Coupon.code == body.code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Cupom '{body.code}' já existe.")

    coupon = Coupon(
        id=str(uuid4()),
        server_id=server.id,
        **body.dict(),
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return _serialize(coupon)


@router.post("/validate")
async def validate_coupon(
    body: ValidateCouponRequest,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Valida e calcula desconto de um cupom (usado pelo bot antes de criar o pedido)."""
    result = await db.execute(
        select(Coupon).where(
            and_(
                Coupon.server_id == server.id,
                Coupon.code == body.code.upper(),
                Coupon.is_active == True,
            )
        )
    )
    coupon = result.scalar_one_or_none()

    if not coupon:
        return {"valid": False, "error": "Cupom inválido ou expirado."}
    if coupon.expires_at and coupon.expires_at < datetime.utcnow():
        return {"valid": False, "error": "Cupom expirado."}
    if coupon.max_uses != -1 and coupon.used_count >= coupon.max_uses:
        return {"valid": False, "error": "Cupom atingiu o limite de usos."}
    if body.subtotal < coupon.min_purchase:
        return {"valid": False, "error": f"Valor mínimo: R${coupon.min_purchase:.2f}"}

    if coupon.discount_type == "percent":
        discount = round(body.subtotal * coupon.discount_value / 100, 2)
        label = f"{coupon.discount_value:.0f}% de desconto"
    else:
        discount = min(coupon.discount_value, body.subtotal)
        label = f"R${coupon.discount_value:.2f} de desconto"

    return {
        "valid":    True,
        "discount": discount,
        "label":    label,
        "final":    round(body.subtotal - discount, 2),
    }


@router.patch("/{coupon_id}/toggle")
async def toggle_coupon(
    coupon_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    coupon = await _get_coupon(coupon_id, server.id, db)
    coupon.is_active = not coupon.is_active
    await db.commit()
    return {"is_active": coupon.is_active}


@router.delete("/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coupon(
    coupon_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    coupon = await _get_coupon(coupon_id, server.id, db)
    await db.delete(coupon)
    await db.commit()


async def _get_coupon(coupon_id: str, server_id: str, db: AsyncSession) -> Coupon:
    result = await db.execute(
        select(Coupon).where(
            and_(Coupon.id == coupon_id, Coupon.server_id == server_id)
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cupom não encontrado.")
    return c


def _serialize(c: Coupon) -> dict:
    return {
        "id":             c.id,
        "code":           c.code,
        "discount_type":  c.discount_type,
        "discount_value": c.discount_value,
        "min_purchase":   c.min_purchase,
        "max_uses":       c.max_uses,
        "used_count":     c.used_count,
        "is_active":      c.is_active,
        "expires_at":     c.expires_at.isoformat() if c.expires_at else None,
        "created_at":     c.created_at.isoformat() if c.created_at else None,
    }
