"""
routers/customers.py — Gestão completa de clientes
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Customer, Order, Ticket, OrderStatus

router = APIRouter()


class CustomerUpdate(BaseModel):
    notes: Optional[str] = None
    email: Optional[str] = None
    tags: Optional[list] = None
    is_blacklisted: Optional[bool] = None
    blacklist_reason: Optional[str] = None


def _fmt(c: Customer) -> dict:
    return {
        "id": str(c.id),
        "discord_id": c.discord_id,
        "username": c.username,
        "email": c.email,
        "notes": c.notes,
        "total_spent": c.total_spent,
        "order_count": c.order_count,
        "is_blacklisted": c.is_blacklisted,
        "blacklist_reason": c.blacklist_reason,
        "tags": c.tags or [],
        "first_purchase": str(c.first_purchase) if c.first_purchase else None,
        "last_purchase": str(c.last_purchase) if c.last_purchase else None,
        "created_at": str(c.created_at),
    }


@router.get("/")
async def list_customers(
    search: Optional[str] = None,
    is_blacklisted: Optional[bool] = None,
    tag: Optional[str] = None,
    sort: str = "total_spent:desc",
    limit: int = Query(50, le=200),
    offset: int = 0,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    q = select(Customer).where(Customer.server_id == server.id)
    if search:
        q = q.where(or_(Customer.username.ilike(f"%{search}%"), Customer.email.ilike(f"%{search}%")))
    if is_blacklisted is not None:
        q = q.where(Customer.is_blacklisted == is_blacklisted)

    # sort
    field, direction = (sort + ":desc").split(":")[:2]
    col_map = {
        "total_spent": Customer.total_spent, "order_count": Customer.order_count,
        "created_at": Customer.created_at, "last_purchase": Customer.last_purchase,
    }
    col = col_map.get(field, Customer.total_spent)
    q = q.order_by(col.desc() if direction == "desc" else col.asc())

    count_q = select(func.count(Customer.id)).where(Customer.server_id == server.id)
    total = (await db.execute(count_q)).scalar()

    res = await db.execute(q.limit(limit).offset(offset))
    return {"customers": [_fmt(c) for c in res.scalars().all()], "total": total}


@router.get("/{customer_id}")
async def get_customer(customer_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    return _fmt(c)


@router.get("/{customer_id}/orders")
async def get_customer_orders(customer_id: str, limit: int = 20, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    res = await db.execute(select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc()).limit(limit))
    orders = res.scalars().all()
    return [{"id": str(o.id), "total": o.total, "status": o.status, "gateway": o.gateway, "created_at": str(o.created_at)} for o in orders]


@router.get("/{customer_id}/tickets")
async def get_customer_tickets(customer_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    res = await db.execute(select(Ticket).where(Ticket.customer_id == customer_id).order_by(Ticket.created_at.desc()))
    return [{"id": str(t.id), "subject": t.subject, "status": t.status, "created_at": str(t.created_at)} for t in res.scalars().all()]


@router.patch("/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    await db.commit(); await db.refresh(c)
    return _fmt(c)


@router.post("/{customer_id}/blacklist")
async def blacklist_customer(customer_id: str, body: dict, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    c.is_blacklisted = True
    c.blacklist_reason = body.get("reason", "")
    await db.commit()
    return {"ok": True}


@router.delete("/{customer_id}/blacklist")
async def unblacklist_customer(customer_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    c = await db.get(Customer, customer_id)
    if not c or c.server_id != server.id: raise HTTPException(404)
    c.is_blacklisted = False; c.blacklist_reason = None
    await db.commit()
    return {"ok": True}
