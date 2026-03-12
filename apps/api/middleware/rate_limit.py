"""
apps/api/middleware/rate_limit.py
Rate limiting por IP + user_id (quando JWT disponível) via Redis
"""
from __future__ import annotations

import os
import redis.asyncio as aioredis
from fastapi import status
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

REDIS_URL  = os.getenv("REDIS_URL", "redis://redis:6379/0")
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM  = "HS256"

# (limite, janela_segundos)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/auth":      (5,   60),   # 5 tentativas de login por minuto
    "/orders":    (10,  60),   # 10 pedidos por minuto
    "/payments":  (30,  60),
    "/products":  (60,  60),
    "default":    (120, 60),
}

SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


def _get_user_id(request: Request) -> str | None:
    try:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
            return payload.get("sub")
    except (JWTError, Exception):
        pass
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._redis = None

    async def _get_redis(self):
        if not self._redis:
            self._redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next):
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path      = request.url.path
        segment   = path.split("/")[1] if "/" in path else path

        limit, window = RATE_LIMITS["default"]
        for prefix, limits in RATE_LIMITS.items():
            if prefix != "default" and path.startswith(prefix):
                limit, window = limits
                break

        # Chave dupla: por IP e por user_id (quando logado)
        user_id = _get_user_id(request)
        keys = [f"rl:ip:{client_ip}:{segment}"]
        if user_id:
            keys.append(f"rl:uid:{user_id}:{segment}")

        try:
            r = await self._get_redis()
            for key in keys:
                current = await r.incr(key)
                if current == 1:
                    await r.expire(key, window)
                if current > limit:
                    retry_after = await r.ttl(key)
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": f"Muitas requisições. Aguarde {retry_after}s."},
                        headers={"Retry-After": str(retry_after)},
                    )

            response = await call_next(request)
            response.headers["X-RateLimit-Limit"]     = str(limit)
            return response

        except Exception:
            return await call_next(request)
