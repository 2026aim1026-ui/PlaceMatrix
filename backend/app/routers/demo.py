"""Demo helpers (only when DEMO_MODE=true)."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..services import not_found

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/reset")
def reset_demo_data():
    """Restore the original demo dataset (wipes every table and uploaded file)."""
    if not settings.demo_mode:
        raise not_found("Endpoint")
    from ..seed import reset_and_seed

    reset_and_seed()
    return {"ok": True}
