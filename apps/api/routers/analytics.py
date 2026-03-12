"""
apps/api/routers/analytics.py
Endpoints de analytics — receita, pedidos, produtos, funil
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Order, OrderItem, Product, Customer, OrderStatus

router = APIRouter()


@router.get("/summary")
async def get_summary(
    period: str = Query("30d", description="7d, 30d, 90d, 1y"),
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Resumo financeiro do período."""
    start = _period_to_date(period)

    result = await db.execute(
        select(
            func.count(Order.id).label("total_orders"),
            func.coalesce(func.sum(Order.total), 0).label("gross_revenue"),
            func.coalesce(func.sum(Order.net_amount), 0).label("net_revenue"),
            func.coalesce(func.sum(Order.fee_amount), 0).label("total_fees"),
            func.coalesce(func.avg(Order.total), 0).label("avg_ticket"),
        ).where(
            and_(
                Order.server_id == server.id,
                Order.status == OrderStatus.PAID,
                Order.paid_at >= start,
            )
        )
    )
    row = result.one()

    # Pedidos pendentes
    pending = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.server_id == server.id, Order.status == OrderStatus.PENDING)
        )
    )
    pending_count = pending.scalar()

    # Total de clientes
    customers = await db.execute(
        select(func.count(Customer.id)).where(Customer.server_id == server.id)
    )
    customer_count = customers.scalar()

    return {
        "period": period,
        "total_orders":   row.total_orders,
        "gross_revenue":  round(row.gross_revenue, 2),
        "net_revenue":    round(row.net_revenue, 2),
        "total_fees":     round(row.total_fees, 2),
        "avg_ticket":     round(row.avg_ticket, 2),
        "pending_orders": pending_count,
        "total_customers": customer_count,
    }


@router.get("/revenue/daily")
async def get_daily_revenue(
    period: str = Query("30d"),
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Receita diária para gráfico de linha."""
    start = _period_to_date(period)

    result = await db.execute(
        select(
            func.date(Order.paid_at).label("date"),
            func.coalesce(func.sum(Order.total), 0).label("gross"),
            func.coalesce(func.sum(Order.net_amount), 0).label("net"),
            func.count(Order.id).label("count"),
        ).where(
            and_(
                Order.server_id == server.id,
                Order.status == OrderStatus.PAID,
                Order.paid_at >= start,
            )
        ).group_by(func.date(Order.paid_at))
        .order_by(func.date(Order.paid_at))
    )

    rows = result.all()
    return {
        "data": [
            {"date": str(r.date), "gross": round(r.gross, 2), "net": round(r.net, 2), "count": r.count}
            for r in rows
        ]
    }


@router.get("/products/top")
async def get_top_products(
    limit: int = 10,
    period: str = Query("30d"),
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Produtos mais vendidos no período."""
    start = _period_to_date(period)

    result = await db.execute(
        select(
            Product.id,
            Product.name,
            Product.price,
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.total_price).label("revenue"),
        )
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            and_(
                Order.server_id == server.id,
                Order.status == OrderStatus.PAID,
                Order.paid_at >= start,
            )
        )
        .group_by(Product.id, Product.name, Product.price)
        .order_by(func.sum(OrderItem.total_price).desc())
        .limit(limit)
    )

    rows = result.all()
    return {
        "products": [
            {
                "id": str(r.id),
                "name": r.name,
                "price": r.price,
                "units_sold": r.units_sold,
                "revenue": round(r.revenue, 2),
            }
            for r in rows
        ]
    }


@router.get("/customers/top")
async def get_top_customers(
    limit: int = 10,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Clientes que mais gastaram."""
    result = await db.execute(
        select(Customer)
        .where(Customer.server_id == server.id)
        .order_by(Customer.total_spent.desc())
        .limit(limit)
    )
    customers = result.scalars().all()
    return {
        "customers": [
            {
                "discord_id": c.discord_id,
                "username": c.username,
                "total_spent": c.total_spent,
                "order_count": c.order_count,
            }
            for c in customers
        ]
    }


@router.get("/funnel")
async def get_conversion_funnel(
    period: str = Query("30d"),
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    """Funil de conversão: criados → pagos → entregues."""
    start = _period_to_date(period)

    base = and_(Order.server_id == server.id, Order.created_at >= start)

    created = await db.execute(select(func.count(Order.id)).where(base))
    paid    = await db.execute(select(func.count(Order.id)).where(and_(base, Order.status == OrderStatus.PAID)))
    delivered = await db.execute(select(func.count(Order.id)).where(and_(base, Order.status == OrderStatus.DELIVERED)))
    refunded  = await db.execute(select(func.count(Order.id)).where(and_(base, Order.status == OrderStatus.REFUNDED)))

    c = created.scalar() or 1
    return {
        "created":   c,
        "paid":      paid.scalar(),
        "delivered": delivered.scalar(),
        "refunded":  refunded.scalar(),
        "conversion_rate": round((paid.scalar() / c) * 100, 1),
    }


def _period_to_date(period: str) -> datetime:
    mapping = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = mapping.get(period, 30)
    return datetime.utcnow() - timedelta(days=days)
