"""
routers/api_keys.py — API Keys públicas para integração
"""
from __future__ import annotations
import hashlib, secrets, os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from middleware.auth import get_current_server, get_current_user
from packages.database.models import ApiKey

router = APIRouter()

ALL_SCOPES = [
    "products:read", "products:write",
    "orders:read",   "orders:write",
    "customers:read","customers:write",
    "analytics:read",
    "coupons:read",  "coupons:write",
    "webhooks:read", "webhooks:write",
]


class ApiKeyCreate(BaseModel):
    name: str
    scopes: list
    expires_at: Optional[str] = None


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _fmt(k: ApiKey, raw: Optional[str] = None) -> dict:
    d = {
        "id": str(k.id),
        "name": k.name,
        "key_prefix": k.key_prefix,
        "scopes": k.scopes,
        "last_used": str(k.last_used) if k.last_used else None,
        "is_active": k.is_active,
        "expires_at": str(k.expires_at) if k.expires_at else None,
        "created_at": str(k.created_at),
    }
    if raw:
        d["key"] = raw   # shown once only
    return d


@router.get("/scopes")
async def get_scopes():
    return {"scopes": ALL_SCOPES}


@router.get("/")
async def list_keys(server=Depends(get_current_server), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ApiKey).where(ApiKey.server_id == server.id, ApiKey.user_id == user.id))
    return [_fmt(k) for k in res.scalars().all()]


@router.post("/", status_code=201)
async def create_key(
    body: ApiKeyCreate,
    server=Depends(get_current_server),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw = "vb_" + secrets.token_urlsafe(32)
    from datetime import datetime
    expires = None
    if body.expires_at:
        try: expires = datetime.fromisoformat(body.expires_at)
        except: pass

    k = ApiKey(
        user_id=user.id, server_id=server.id,
        name=body.name, key_hash=_hash(raw),
        key_prefix=raw[:10], scopes=body.scopes,
        expires_at=expires,
    )
    db.add(k); await db.commit(); await db.refresh(k)
    return _fmt(k, raw=raw)  # key shown once!


@router.delete("/{key_id}", status_code=204)
async def revoke_key(key_id: str, server=Depends(get_current_server), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    k = await db.get(ApiKey, key_id)
    if not k or k.server_id != server.id: raise HTTPException(404)
    k.is_active = False
    await db.commit()
