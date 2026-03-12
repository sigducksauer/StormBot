"""
apps/api/routers/orders.py
Endpoints de pedidos — criação, consulta, cancelamento, reembolso
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional


from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from services.order_service import OrderService
from services.delivery_service import DeliveryService

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────
class CreateOrderRequest(BaseModel):
    customer_discord_id: int
    customer_username:   str
    items: List[dict]       # [{product_id, variant_id?, quantity}]
    coupon_code: Optional[str] = None
    payment_method: str     # "pix", "credit_card", "boleto", "stripe"
    gateway: str            # "mercadopago", "stripe", "pix_manual"


class OrderResponse(BaseModel):
    id:               str
    status:           str
    total:            float
    fee_amount:       float
    net_amount:       float
    payment_method:   str
    gateway_order_id: Optional[str]
    pix_code:         Optional[str]
    pix_qr_url:       Optional[str]
    expires_at:       Optional[datetime]
    created_at:       datetime

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────
@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: CreateOrderRequest,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """
    Cria um novo pedido. Chamado pelo bot ao iniciar o checkout.
    Retorna os dados de pagamento (código Pix, link de pagamento, etc.)
    """
    svc = OrderService(db)
    order = await svc.create_order(
        server_id=server.id,
        customer_discord_id=body.customer_discord_id,
        customer_username=body.customer_username,
        items=body.items,
        coupon_code=body.coupon_code,
        payment_method=body.payment_method,
        gateway=body.gateway,
    )
    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    order = await svc.get_order(str(order_id), server.id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    return order


@router.get("/")
async def list_orders(
    status: Optional[str] = None,
    customer_discord_id: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    svc = OrderService(db)
    orders, total = await svc.list_orders(
        server_id=server.id,
        status=status,
        customer_discord_id=customer_discord_id,
        limit=limit,
        offset=offset,
    )
    return {"orders": orders, "total": total, "limit": limit, "offset": offset}


@router.post("/{order_id}/refund")
async def refund_order(
    order_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Reembolsa um pedido pago via gateway."""
    svc = OrderService(db)
    result = await svc.refund_order(str(order_id), server.id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "message": "Reembolso processado com sucesso."}


@router.post("/{order_id}/deliver")
async def deliver_order(
    order_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Força entrega manual de um pedido (staff)."""
    svc = OrderService(db)
    delivery = DeliveryService(db)
    order = await svc.get_order(str(order_id), server.id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    await delivery.deliver(order)
    return {"success": True, "message": "Entrega realizada."}


def _serialize_order(o) -> dict:
    return {
        "id":               o.id,
        "status":           o.status.value if hasattr(o.status, "value") else o.status,
        "total":            o.total,
        "fee_amount":       o.fee_amount,
        "net_amount":       o.net_amount,
        "payment_method":   o.payment_method,
        "gateway":          o.gateway,
        "gateway_order_id": o.gateway_order_id,
        "pix_code":         o.pix_code,
        "pix_qr_url":       o.pix_qr_url,
        "expires_at":       o.expires_at.isoformat() if o.expires_at else None,
        "paid_at":          o.paid_at.isoformat() if o.paid_at else None,
        "created_at":       o.created_at.isoformat() if o.created_at else None,
    }
