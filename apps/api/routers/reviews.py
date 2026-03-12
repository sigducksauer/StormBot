"""
routers/reviews.py — Sistema de avaliações de produtos
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import ProductReview, Product, Customer

router = APIRouter()


class ReviewCreate(BaseModel):
    product_id: str
    customer_discord_id: int
    customer_username: str
    order_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


def _fmt(r: ProductReview) -> dict:
    return {
        "id": str(r.id),
        "product_id": str(r.product_id),
        "customer_id": str(r.customer_id),
        "order_id": str(r.order_id) if r.order_id else None,
        "rating": r.rating,
        "comment": r.comment,
        "is_visible": r.is_visible,
        "created_at": str(r.created_at),
    }


@router.get("/")
async def list_reviews(
    product_id: Optional[str] = None,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    q = (select(ProductReview)
         .join(Product, ProductReview.product_id == Product.id)
         .where(Product.server_id == server.id))
    if product_id:
        q = q.where(ProductReview.product_id == product_id)
    q = q.order_by(ProductReview.created_at.desc())
    res = await db.execute(q)
    return [_fmt(r) for r in res.scalars().all()]


@router.get("/summary")
async def review_summary(product_id: str, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p or p.server_id != server.id: raise HTTPException(404)
    agg = await db.execute(
        select(func.avg(ProductReview.rating), func.count(ProductReview.id))
        .where(and_(ProductReview.product_id == product_id, ProductReview.is_visible == True))
    )
    avg, count = agg.one()
    # distribution
    dist_res = await db.execute(
        select(ProductReview.rating, func.count(ProductReview.id))
        .where(ProductReview.product_id == product_id)
        .group_by(ProductReview.rating)
    )
    dist = {row[0]: row[1] for row in dist_res.all()}
    return {"product_id": product_id, "avg_rating": round(avg or 0, 2), "count": count, "distribution": dist}


@router.post("/", status_code=201)
async def create_review(body: ReviewCreate, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, body.product_id)
    if not p or p.server_id != server.id: raise HTTPException(404)

    # find customer
    res = await db.execute(select(Customer).where(and_(Customer.server_id == server.id, Customer.discord_id == body.customer_discord_id)))
    c = res.scalar_one_or_none()
    if not c:
        c = Customer(server_id=server.id, discord_id=body.customer_discord_id, username=body.customer_username)
        db.add(c); await db.flush()

    # check duplicate
    ex = await db.execute(select(ProductReview).where(and_(ProductReview.product_id == body.product_id, ProductReview.customer_id == c.id)))
    if ex.scalar_one_or_none(): raise HTTPException(400, "Cliente já avaliou este produto.")

    r = ProductReview(product_id=body.product_id, customer_id=c.id, order_id=body.order_id, rating=body.rating, comment=body.comment)
    db.add(r); await db.commit(); await db.refresh(r)
    return _fmt(r)


@router.patch("/{review_id}/visibility")
async def toggle_review(review_id: str, body: dict, server=Depends(get_current_server), db: AsyncSession = Depends(get_db)):
    r = await db.get(ProductReview, review_id)
    if not r: raise HTTPException(404)
    p = await db.get(Product, str(r.product_id))
    if not p or p.server_id != server.id: raise HTTPException(403)
    r.is_visible = body.get("is_visible", not r.is_visible)
    await db.commit()
    return {"is_visible": r.is_visible}
