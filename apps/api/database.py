"""
apps/api/database.py
Conexão assíncrona com PostgreSQL via SQLAlchemy + asyncpg
"""
from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importa Base dos modelos (única fonte de verdade)
from packages.database.models import Base  # noqa: F401 — re-exportado para os routers

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://vendbot:senha@postgres:5432/vendbot",
)

# Normaliza URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
