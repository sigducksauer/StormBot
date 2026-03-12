"""
apps/api/main.py
FastAPI — ponto de entrada da API VendBot v2
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import engine, Base
from routers import (
    auth, servers, products, orders, payments, gateways,
    embeds, coupons, analytics, webhooks,
    affiliates, tickets, automations, customers,
    audit, team, api_keys, reviews, onboarding, blacklist
)
from middleware.rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("api")

PANEL_URL     = os.getenv("NEXTAUTH_URL", "http://localhost:3000")
EXTRA_ORIGINS = os.getenv("EXTRA_ORIGINS", "").split(",")
DEBUG         = os.getenv("DEBUG", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 VendBot API v2 iniciando...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("✅ Banco de dados pronto.")
    yield
    log.info("🛑 API encerrando...")


app = FastAPI(
    title="VendBot API",
    description="API do sistema de vendas VendBot para Discord",
    version="2.0.0",
    lifespan=lifespan,
    # Docs apenas em ambiente de desenvolvimento
    docs_url="/docs"  if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
)

# ── CORS ────────────────────────────────────────────────────
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    PANEL_URL,
    *[o.strip() for o in EXTRA_ORIGINS if o.strip()],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

# ── Routers ─────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/auth",        tags=["Auth"])
app.include_router(servers.router,     prefix="/servers",     tags=["Servers"])
app.include_router(products.router,    prefix="/products",    tags=["Products"])
app.include_router(orders.router,      prefix="/orders",      tags=["Orders"])
app.include_router(payments.router,    prefix="/payments",    tags=["Payments"])
app.include_router(gateways.router,    prefix="/gateways",    tags=["Gateways"])
app.include_router(embeds.router,      prefix="/embeds",      tags=["Embeds"])
app.include_router(coupons.router,     prefix="/coupons",     tags=["Coupons"])
app.include_router(analytics.router,   prefix="/analytics",   tags=["Analytics"])
app.include_router(webhooks.router,    prefix="/webhooks",    tags=["Webhooks"])
app.include_router(affiliates.router,  prefix="/affiliates",  tags=["Affiliates"])
app.include_router(tickets.router,     prefix="/tickets",     tags=["Tickets"])
app.include_router(automations.router, prefix="/automations", tags=["Automations"])
app.include_router(customers.router,   prefix="/customers",   tags=["Customers"])
app.include_router(audit.router,       prefix="/audit",       tags=["Audit"])
app.include_router(team.router,        prefix="/team",        tags=["Team"])
app.include_router(api_keys.router,    prefix="/api-keys",    tags=["API Keys"])
app.include_router(reviews.router,     prefix="/reviews",     tags=["Reviews"])
app.include_router(onboarding.router,  prefix="/onboarding",  tags=["Onboarding"])
app.include_router(blacklist.router,   prefix="/blacklist",   tags=["Blacklist"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Loga sem expor detalhes internos ao cliente
    log.error(f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor."})
