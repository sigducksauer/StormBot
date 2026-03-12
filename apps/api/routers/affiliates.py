"""
routers/affiliates.py — Sistema de afiliados
"""
from __future__ import annotations
import random, string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Affiliate, AffiliatePayout, Order

router = APIRouter()

def _gen_code(length=8):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class AffiliateCreate(BaseModel):
    discord_id: int
    username: str
    commission_rate: Optional[float] = 5.0
    pix_key: Optional[str] = None


class PayoutRequest(BaseModel):
    amount: float
    notes: Optional[str] = None


def _fmt(a: Affiliate) -> dict:
    return {
        "id": str(a.id),
        "discord_id": a.discord_id,
        "username": a.username,
        "referral_code": a.referral_code,
        "commission_rate": a.commission_rate,
        "total_referrals": a.total_referrals,
        "total_revenue": a.total_revenue,
        "total_commission": a.total_commission,
        "pending_commission": a.pending_commission,
        "paid_commission": a.paid_commission,
        "is_active": a.is_active,
        "pix_key": a.pix_key,
        "created_at": str(a.created_at),
    }


@router.get("/")
async def list_affiliates(server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Affiliate).where(Affiliate.server_id == server.id)
        .order_by(Affiliate.total_commission.desc())
    )
    return [_fmt(a) for a in res.scalars().all()]


@router.post("/", status_code=201)
async def create_affiliate(
    body: AffiliateCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    # check duplicate
    ex = await db.execute(
        select(Affiliate).where(and_(Affiliate.server_id == server.id, Affiliate.discord_id == body.discord_id))
    )
    if ex.scalar_one_or_none():
        raise HTTPException(400, "Afiliado já cadastrado.")
    code = _gen_code()
    a = Affiliate(
        server_id=server.id, discord_id=body.discord_id, username=body.username,
        referral_code=code, commission_rate=body.commission_rate, pix_key=body.pix_key
    )
    db.add(a); await db.commit(); await db.refresh(a)
    return _fmt(a)


@router.get("/{affiliate_id}")
async def get_affiliate(affiliate_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = await db.get(Affiliate, affiliate_id)
    if not a or a.server_id != server.id:
        raise HTTPException(404)
    return _fmt(a)


@router.patch("/{affiliate_id}")
async def update_affiliate(
    affiliate_id: str, body: dict,
    server=Depends(get_current_server), db: AsyncSession = Depends(get_db)
):
    a = await db.get(Affiliate, affiliate_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    for k, v in body.items():
        if hasattr(a, k): setattr(a, k, v)
    await db.commit(); await db.refresh(a)
    return _fmt(a)


@router.delete("/{affiliate_id}", status_code=204)
async def delete_affiliate(affiliate_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    a = await db.get(Affiliate, affiliate_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    await db.delete(a); await db.commit()


@router.post("/{affiliate_id}/payout", status_code=201)
async def request_payout(
    affiliate_id: str, body: PayoutRequest,
    server=Depends(get_current_server), db: AsyncSession = Depends(get_db)
):
    a = await db.get(Affiliate, affiliate_id)
    if not a or a.server_id != server.id: raise HTTPException(404)
    if body.amount > a.pending_commission:
        raise HTTPException(400, "Valor maior que comissão pendente.")
    p = AffiliatePayout(affiliate_id=affiliate_id, amount=body.amount, notes=body.notes)
    a.pending_commission -= body.amount
    db.add(p); await db.commit(); await db.refresh(p)
    return {"id": str(p.id), "amount": p.amount, "status": p.status}


@router.get("/by-code/{code}")
async def get_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """Used by bot to resolve referral code."""
    res = await db.execute(select(Affiliate).where(Affiliate.referral_code == code))
    a = res.scalar_one_or_none()
    if not a or not a.is_active:
        raise HTTPException(404)
    return {"id": str(a.id), "server_id": str(a.server_id), "commission_rate": a.commission_rate}
