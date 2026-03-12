"""
apps/api/routers/auth.py
Autenticação via Discord OAuth2 + emissão de JWT
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from packages.database.models import User

router = APIRouter()

DISCORD_CLIENT_ID     = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI  = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:8000/auth/discord/callback")
SECRET_KEY            = os.getenv("SECRET_KEY", "changeme")
ALGORITHM             = "HS256"
ACCESS_TOKEN_EXPIRE   = timedelta(days=7)
DISCORD_API           = "https://discord.com/api/v10"
PANEL_URL             = os.getenv("NEXTAUTH_URL", "http://localhost:3000")


def _make_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE
    return jwt.encode(
        {"sub": str(user.id), "discord_id": str(user.discord_id), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")


@router.get("/discord/login")
async def discord_login():
    scopes = "identify%20email%20guilds"
    url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={DISCORD_CLIENT_ID}"
        f"&redirect_uri={DISCORD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scopes}"
    )
    return RedirectResponse(url)


@router.get("/discord/callback")
async def discord_callback(code: str, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient(timeout=15) as client:
        # Troca code por token Discord
        token_resp = await client.post(
            f"{DISCORD_API}/oauth2/token",
            data={
                "client_id":     DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if not token_resp.is_success:
            raise HTTPException(status_code=400, detail="Erro ao autenticar com Discord.")
        discord_token = token_resp.json()["access_token"]

        # Busca usuário
        user_resp = await client.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {discord_token}"},
        )
        if not user_resp.is_success:
            raise HTTPException(status_code=400, detail="Erro ao buscar dados do Discord.")
        d = user_resp.json()

    avatar = (
        f"https://cdn.discordapp.com/avatars/{d['id']}/{d['avatar']}.png"
        if d.get("avatar") else None
    )

    # Upsert usuário
    result = await db.execute(select(User).where(User.discord_id == int(d["id"])))
    user = result.scalar_one_or_none()

    if not user:
        from uuid import uuid4
        user = User(
            id=str(uuid4()),
            discord_id=int(d["id"]),
            username=d["username"],
            email=d.get("email"),
            avatar=avatar,
        )
        db.add(user)
    else:
        user.username = d["username"]
        user.email    = d.get("email")
        user.avatar   = avatar

    await db.commit()
    await db.refresh(user)

    token = _make_token(user)
    return RedirectResponse(f"{PANEL_URL}/auth/success?token={token}")


@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido.")

    payload = _decode(auth.split(" ", 1)[1])
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    return {
        "id":         str(user.id),
        "discord_id": user.discord_id,
        "username":   user.username,
        "email":      user.email,
        "avatar":     user.avatar,
    }


class TokenRefreshRequest(BaseModel):
    token: str


@router.post("/refresh")
async def refresh_token(body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = _decode(body.token)
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return {"access_token": _make_token(user)}
