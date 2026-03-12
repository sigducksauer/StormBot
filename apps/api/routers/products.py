"""
apps/api/routers/products.py
CRUD completo de produtos com controle de plano e estoque
"""
from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import Product, ProductVariant, ProductKey, ProductType, PlanType

router = APIRouter()

PLAN_PRODUCT_LIMITS = {
    PlanType.SIMPLES:    5,
    PlanType.STANDARD:   30,
    PlanType.PREMIUM:    -1,
    PlanType.ENTERPRISE: -1,
}


class ProductCreate(BaseModel):
    name:           str
    description:    Optional[str]   = None
    price:          float
    original_price: Optional[float] = None
    product_type:   str             = "key"
    image_url:      Optional[str]   = None
    stock:          int             = -1
    stock_alert:    int             = 5
    sort_order:     int             = 0

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Preço deve ser maior que zero.")
        return round(v, 2)

    @field_validator("product_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        allowed = [t.value for t in ProductType]
        if v not in allowed:
            raise ValueError(f"Tipo inválido. Use: {allowed}")
        return v


class ProductUpdate(BaseModel):
    name:           Optional[str]   = None
    description:    Optional[str]   = None
    price:          Optional[float] = None
    original_price: Optional[float] = None
    image_url:      Optional[str]   = None
    stock:          Optional[int]   = None
    stock_alert:    Optional[int]   = None
    is_active:      Optional[bool]  = None
    sort_order:     Optional[int]   = None


class VariantCreate(BaseModel):
    name:  str
    price: float
    stock: int = -1


class BulkKeysRequest(BaseModel):
    keys: List[str]


@router.get("/")
async def list_products(
    active: Optional[bool] = Query(None),
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).where(Product.server_id == server.id)
    if active is not None:
        query = query.where(Product.is_active == active)
    query = query.order_by(Product.sort_order, Product.created_at)
    result = await db.execute(query)
    return [_serialize(p) for p in result.scalars().all()]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    limit = PLAN_PRODUCT_LIMITS.get(server.plan, 5)
    if limit != -1:
        count = (await db.execute(
            select(func.count(Product.id)).where(
                and_(Product.server_id == server.id, Product.is_active == True)
            )
        )).scalar()
        if count >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Limite de {limit} produtos atingido no plano {server.plan}. Faça upgrade.",
            )

    product = Product(
        id=str(uuid4()),
        server_id=server.id,
        name=body.name,
        description=body.description,
        price=body.price,
        original_price=body.original_price,
        product_type=body.product_type,
        image_url=body.image_url,
        stock=body.stock,
        stock_alert=body.stock_alert,
        sort_order=body.sort_order,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return _serialize(product)


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    return _serialize(await _get(product_id, server.id, db))


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    product = await _get(product_id, server.id, db)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(product, key, value)
    await db.commit()
    await db.refresh(product)
    return _serialize(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    product = await _get(product_id, server.id, db)
    product.is_active = False
    await db.commit()


@router.post("/{product_id}/variants", status_code=status.HTTP_201_CREATED)
async def add_variant(
    product_id: str,
    body: VariantCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    await _get(product_id, server.id, db)
    variant = ProductVariant(id=str(uuid4()), product_id=product_id, **body.model_dump())
    db.add(variant)
    await db.commit()
    return {"id": variant.id, "name": variant.name, "price": variant.price}


@router.post("/{product_id}/keys")
async def add_keys(
    product_id: str,
    body: BulkKeysRequest,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    await _get(product_id, server.id, db)
    added = 0
    for k in body.keys:
        k = k.strip()
        if k:
            db.add(ProductKey(id=str(uuid4()), product_id=product_id, key_value=k))
            added += 1
    await db.commit()
    return {"added": added}


@router.get("/{product_id}/keys/count")
async def get_keys_count(
    product_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    await _get(product_id, server.id, db)
    count = (await db.execute(
        select(func.count(ProductKey.id)).where(
            and_(ProductKey.product_id == product_id, ProductKey.is_used == False)
        )
    )).scalar()
    return {"available_keys": count}


async def _get(product_id: str, server_id: str, db: AsyncSession) -> Product:
    result = await db.execute(
        select(Product).where(and_(Product.id == product_id, Product.server_id == server_id))
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return p


def _serialize(p: Product) -> dict:
    return {
        "id":             p.id,
        "name":           p.name,
        "description":    p.description,
        "price":          p.price,
        "original_price": p.original_price,
        "product_type":   p.product_type.value if hasattr(p.product_type, "value") else p.product_type,
        "image_url":      p.image_url,
        "is_active":      p.is_active,
        "stock":          p.stock,
        "stock_alert":    p.stock_alert,
        "sort_order":     p.sort_order,
        "created_at":     p.created_at.isoformat() if p.created_at else None,
    }
