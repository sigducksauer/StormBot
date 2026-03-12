"""
apps/api/routers/embeds.py
Configurações visuais das embeds por servidor
"""
from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from middleware.auth import get_current_server
from packages.database.models import EmbedConfig

router = APIRouter()

EMBED_NAMES = ["loja", "produto", "checkout", "pix", "sucesso", "erro", "dm_entrega"]


class EmbedField(BaseModel):
    name:   str
    value:  str
    inline: bool = False


class EmbedConfigCreate(BaseModel):
    name:          str
    title:         Optional[str]       = None
    description:   Optional[str]       = None
    color:         Optional[str]       = "#5865F2"
    thumbnail_url: Optional[str]       = None
    image_url:     Optional[str]       = None
    footer_text:   Optional[str]       = None
    footer_icon:   Optional[str]       = None
    author_name:   Optional[str]       = None
    author_icon:   Optional[str]       = None
    fields:        List[EmbedField]    = []


@router.get("/")
async def list_embeds(
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmbedConfig).where(EmbedConfig.server_id == server.id)
    )
    return [_serialize(e) for e in result.scalars().all()]


@router.get("/{embed_name}")
async def get_embed(
    embed_name: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmbedConfig).where(
            and_(EmbedConfig.server_id == server.id, EmbedConfig.name == embed_name)
        )
    )
    embed = result.scalar_one_or_none()
    if not embed:
        raise HTTPException(status_code=404, detail="Embed não encontrada.")
    return _serialize(embed)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_or_update_embed(
    body: EmbedConfigCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    # Upsert por (server_id, name)
    result = await db.execute(
        select(EmbedConfig).where(
            and_(EmbedConfig.server_id == server.id, EmbedConfig.name == body.name)
        )
    )
    embed = result.scalar_one_or_none()

    data = body.model_dump()
    fields_data = [f.model_dump() for f in body.fields]

    if embed:
        for k, v in data.items():
            if k == "fields":
                embed.fields = fields_data
            else:
                setattr(embed, k, v)
    else:
        embed = EmbedConfig(
            id=str(uuid4()),
            server_id=server.id,
            **{k: (fields_data if k == "fields" else v) for k, v in data.items()},
        )
        db.add(embed)

    await db.commit()
    await db.refresh(embed)
    return _serialize(embed)


@router.put("/{embed_id}")
async def update_embed(
    embed_id: str,
    body: EmbedConfigCreate,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    embed = await db.get(EmbedConfig, embed_id)
    if not embed or embed.server_id != server.id:
        raise HTTPException(status_code=404, detail="Embed não encontrada.")

    data = body.model_dump()
    for k, v in data.items():
        if k == "fields":
            embed.fields = [f.model_dump() for f in body.fields]
        else:
            setattr(embed, k, v)

    await db.commit()
    await db.refresh(embed)
    return _serialize(embed)


@router.delete("/{embed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_embed(
    embed_id: str,
    server=Depends(get_current_server),
    db: AsyncSession = Depends(get_db),
):
    embed = await db.get(EmbedConfig, embed_id)
    if not embed or embed.server_id != server.id:
        raise HTTPException(status_code=404, detail="Embed não encontrada.")
    await db.delete(embed)
    await db.commit()


def _serialize(e: EmbedConfig) -> dict:
    return {
        "id":            e.id,
        "name":          e.name,
        "title":         e.title,
        "description":   e.description,
        "color":         e.color or "#5865F2",
        "thumbnail_url": e.thumbnail_url,
        "image_url":     e.image_url,
        "footer_text":   e.footer_text,
        "footer_icon":   e.footer_icon,
        "author_name":   e.author_name,
        "author_icon":   e.author_icon,
        "fields":        e.fields or [],
        "updated_at":    e.updated_at.isoformat() if e.updated_at else None,
    }
