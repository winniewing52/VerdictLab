from __future__ import annotations

import re

MODES = ("redacted", "raw")

_URL = re.compile(r"(?:https?://|www\.)\S+", re.I)
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
_HANDLE = re.compile(r"(?<![\w/])(?:/?u/[A-Za-z0-9_-]+|@[A-Za-z0-9_]+)")
_PHONE = re.compile(r"(?<![\w-])\+?\d[\d\s().-]{7,}\d(?![\w-])")
_DATE = re.compile(r"\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}")
_SPACE = re.compile(r"\s+")

def _tidy(text: str) -> str:
    return _SPACE.sub(" ", text).strip()

def _looks_like_phone(match: re.Match) -> bool:
    value = match.group(0)
    if _DATE.fullmatch(value.strip()):
        return False
    return 9 <= sum(ch.isdigit() for ch in value) <= 15

def scoring_text(text: str) -> str:
    """Text used for scoring and de-duplication, identical in every privacy mode."""
    text = _EMAIL.sub(" ", text or "")
    text = _URL.sub(" ", text)
    text = _HANDLE.sub("[user]", text)
    return _tidy(text)

def apply_privacy(text: str, mode: str) -> tuple[str, dict]:
    """Return (text to store, how many items were redacted by type)."""
    counts = {"emails": 0, "phones": 0, "handles": 0, "urls": 0}
    text = text or ""
    if mode not in MODES:
        mode = "redacted"
    if mode == "raw":
        return _tidy(text), counts

    text, counts["emails"] = _EMAIL.subn("[email]", text)
    text, counts["urls"] = _URL.subn("[link]", text)
    text, counts["handles"] = _HANDLE.subn("[user]", text)

    phones = 0

    def _phone(match: re.Match) -> str:
        nonlocal phones
        if _looks_like_phone(match):
            phones += 1
            return "[phone]"
        return match.group(0)

    text = _PHONE.sub(_phone, text)
    counts["phones"] = phones
    return _tidy(text), counts
