"""
routers/tickets.py — Sistema de tickets de suporte
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Ticket, TicketMessage, TicketStatus, Customer

router = APIRouter()


class TicketCreate(BaseModel):
    customer_discord_id: int
    customer_username: str
    subject: str
    priority: Optional[str] = "normal"
    order_id: Optional[str] = None
    channel_id: Optional[int] = None


class MessageCreate(BaseModel):
    author_id: int
    author_name: str
    content: str
    is_staff: bool = False


class TicketClose(BaseModel):
    rating: Optional[int] = None
    rating_comment: Optional[str] = None


def _fmt(t: Ticket) -> dict:
    return {
        "id": str(t.id),
        "subject": t.subject,
        "status": t.status,
        "priority": t.priority,
        "customer_id": str(t.customer_id),
        "order_id": str(t.order_id) if t.order_id else None,
        "channel_id": t.channel_id,
        "rating": t.rating,
        "rating_comment": t.rating_comment,
        "closed_at": str(t.closed_at) if t.closed_at else None,
        "created_at": str(t.created_at),
        "updated_at": str(t.updated_at) if t.updated_at else None,
    }


@router.get("/")
async def list_tickets(
    status: Optional[str] = None, limit: int = 50, offset: int = 0,
    server=Depends(get_current_server), db: AsyncSession = Depends(get_db)
):
    q = select(Ticket).where(Ticket.server_id == server.id)
    if status:
        q = q.where(Ticket.status == status)
    q = q.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(q)
    tickets = res.scalars().all()

    from sqlalchemy import func
    count_q = select(func.count(Ticket.id)).where(Ticket.server_id == server.id)
    if status: count_q = count_q.where(Ticket.status == status)
    total = (await db.execute(count_q)).scalar()

    return {"tickets": [_fmt(t) for t in tickets], "total": total}


@router.post("/", status_code=201)
async def create_ticket(body: TicketCreate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    # find or create customer
    from packages.database.models import Customer
    res = await db.execute(
        select(Customer).where(and_(Customer.server_id == server.id, Customer.discord_id == body.customer_discord_id))
    )
    customer = res.scalar_one_or_none()
    if not customer:
        customer = Customer(server_id=server.id, discord_id=body.customer_discord_id, username=body.customer_username)
        db.add(customer); await db.flush()

    t = Ticket(
        server_id=server.id, customer_id=customer.id,
        subject=body.subject, priority=body.priority,
        order_id=body.order_id, channel_id=body.channel_id,
    )
    db.add(t); await db.commit(); await db.refresh(t)
    return _fmt(t)


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    t = await db.get(Ticket, ticket_id)
    if not t or t.server_id != server.id: raise HTTPException(404)
    msgs_res = await db.execute(select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at))
    msgs = [{"id": str(m.id), "author_id": m.author_id, "author_name": m.author_name, "content": m.content, "is_staff": m.is_staff, "created_at": str(m.created_at)} for m in msgs_res.scalars().all()]
    result = _fmt(t); result["messages"] = msgs
    return result


@router.post("/{ticket_id}/messages", status_code=201)
async def add_message(ticket_id: str, body: MessageCreate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    t = await db.get(Ticket, ticket_id)
    if not t or t.server_id != server.id: raise HTTPException(404)
    if t.status == TicketStatus.CLOSED: raise HTTPException(400, "Ticket fechado.")
    m = TicketMessage(ticket_id=ticket_id, author_id=body.author_id, author_name=body.author_name, content=body.content, is_staff=body.is_staff)
    db.add(m); await db.commit()
    return {"id": str(m.id), "created_at": str(m.created_at)}


@router.post("/{ticket_id}/close")
async def close_ticket(ticket_id: str, body: TicketClose, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    t = await db.get(Ticket, ticket_id)
    if not t or t.server_id != server.id: raise HTTPException(404)
    t.status = TicketStatus.CLOSED
    t.closed_at = datetime.utcnow()
    if body.rating: t.rating = body.rating
    if body.rating_comment: t.rating_comment = body.rating_comment
    await db.commit(); await db.refresh(t)
    return _fmt(t)


@router.patch("/{ticket_id}")
async def update_ticket(ticket_id: str, body: dict, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    t = await db.get(Ticket, ticket_id)
    if not t or t.server_id != server.id: raise HTTPException(404)
    for k, v in body.items():
        if hasattr(t, k): setattr(t, k, v)
    await db.commit(); await db.refresh(t)
    return _fmt(t)
