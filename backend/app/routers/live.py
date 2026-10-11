from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.live import analyse_text

router = APIRouter(prefix="/live", tags=["live"])

MAX_CHARS = 2000

class LiveRequest(BaseModel):
    text: str

@router.post("")
def analyse_live(payload: LiveRequest):
    """Score one piece of text. Public on purpose: nothing is stored."""
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "Enter some text to analyse.")
    if len(text) > MAX_CHARS:
        raise HTTPException(413, f"Text is too long (max {MAX_CHARS} characters).")
    try:
        return analyse_text(text)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
