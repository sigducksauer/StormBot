"""
routers/onboarding.py — Wizard de onboarding multi-step
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth import get_current_user
from packages.database.models import Server, User

router = APIRouter()

STEPS = {
    0: "connect_discord",
    1: "select_server",
    2: "setup_shop",    # set shop channel, name, first gateway
    3: "create_product",
    4: "complete",
}


class OnboardingStep(BaseModel):
    step: int
    data: dict = {}


@router.get("/status")
async def onboarding_status(server_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(Server, server_id)
    if not s: raise HTTPException(404)
    return {
        "current_step": s.onboarding_step,
        "is_done": s.onboarding_done,
        "steps": STEPS,
        "total_steps": len(STEPS) - 1,
    }


@router.post("/advance")
async def advance_step(body: OnboardingStep, server_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(Server, server_id)
    if not s: raise HTTPException(404)

    # Apply step data
    if body.step == 2 and body.data:
        settings = s.settings or {}
        settings.update({
            "shop_channel_id": body.data.get("shop_channel_id"),
            "shop_name": body.data.get("shop_name", s.name),
        })
        s.settings = settings

    s.onboarding_step = max(s.onboarding_step, body.step + 1)
    if s.onboarding_step >= 4:
        s.onboarding_done = True

    await db.commit()
    return {"current_step": s.onboarding_step, "is_done": s.onboarding_done}


@router.post("/complete")
async def complete_onboarding(server_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(Server, server_id)
    if not s: raise HTTPException(404)
    s.onboarding_done = True; s.onboarding_step = 4
    await db.commit()
    return {"is_done": True}
