"""
apps/api/middleware/auth.py
Autenticação JWT + server context + internal secret — hardened
"""
from __future__ import annotations

import os
import secrets

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from packages.database.models import User, Server

SECRET_KEY      = os.environ["SECRET_KEY"]          # obrigatório — sem fallback fraco
ALGORITHM       = "HS256"
INTERNAL_SECRET = os.environ["API_INTERNAL_SECRET"] # obrigatório — sem fallback fraco

if len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY deve ter pelo menos 32 caracteres.")
if len(INTERNAL_SECRET) < 32:
    raise RuntimeError("API_INTERNAL_SECRET deve ter pelo menos 32 caracteres.")


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido.")
    return auth.split(" ", 1)[1]


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return user


async def get_current_server(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Server:
    x_guild_id      = request.headers.get("X-Guild-Id")
    x_server_id     = request.headers.get("X-Server-Id")
    internal_secret = request.headers.get("X-Internal-Secret", "")

    # Chamada interna do bot — comparação em tempo constante
    if x_guild_id and secrets.compare_digest(internal_secret, INTERNAL_SECRET):
        result = await db.execute(
            select(Server).where(Server.discord_id == int(x_guild_id))
        )
        server = result.scalar_one_or_none()
        if not server:
            raise HTTPException(status_code=404, detail="Servidor não registrado.")
        return server

    # Chamada do painel (JWT)
    token = _extract_token(request)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido.")

    if not x_server_id:
        raise HTTPException(status_code=400, detail="Header X-Server-Id obrigatório.")

    server = await db.get(Server, x_server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado.")
    if server.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão para este servidor.")
    if not server.is_active:
        raise HTTPException(status_code=403, detail="Servidor suspenso.")

    return server
