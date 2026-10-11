from __future__ import annotations

import math
import os
import re
from collections import Counter

DIMENSIONS = ("pleasantness", "attention", "sensitivity", "aptitude")
MAX_NGRAM = 4
MIN_COVERAGE = float(os.getenv("SENTIC_MIN_COVERAGE", "0.5"))

_STOP = frozenset(
    """i me my myself we our ours you your yours he him his she her hers it its they them
    their theirs what which who whom this that these those am is are was were be been being
    have has had having do does did doing a an the and but if or because as until while of at
    by for with about against between into through during before after above below to from up
    down in out on off over under again further then once here there when where why how all
    any both each few more most other some such no nor not only own same so than too very s t
    can will just don should now im ive youre theyre dont didnt cant wont isnt arent wasnt
    also would could""".split()
)
_NEGATORS = frozenset({"not", "no", "never", "nor", "cannot", "cant", "dont", "didnt", "doesnt",
                       "isnt", "arent", "wasnt", "werent", "wont", "without", "hardly"})
_TOKEN = re.compile(r"[a-z][a-z'\-]*")
_SUFFIXES = (("ies", "y"), ("ing", ""), ("ing", "e"), ("ed", ""), ("ed", "e"),
             ("es", ""), ("s", ""), ("ly", ""))

_data: dict | None = None
_load_error: str | None = None

def _load() -> dict | None:
    """Load the SenticNet 9 English lexicon once (it is large: ~250 MB on disk)."""
    global _data, _load_error
    if _data is not None or _load_error is not None:
        return _data
    try:
        from sentic import SenticWord

        _data = SenticWord("en").data
    except Exception as exc:
        _load_error = f"{type(exc).__name__}: {exc}"
    return _data

def available() -> bool:
    return _load() is not None

def load_error() -> str | None:
    _load()
    return _load_error

def _num(value) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0

def _lookup(words: list[str]) -> tuple[str, list] | None:
    """Exact key first, then suffix variants of the last word. Returns (key, row)."""
    data = _data
    if data is None:
        return None
    head, last = words[:-1], words[-1]
    candidates = [last]
    for suffix, replacement in _SUFFIXES:
        if last.endswith(suffix) and len(last) - len(suffix) >= 3:
            candidates.append(last[: -len(suffix)] + replacement)
    for cand in candidates:
        key = "_".join(head + [cand])
        row = data.get(key)
        if row is not None and len(row) >= 8:
            return key, row
    return None

def _tokens(text: str) -> list[str]:
    text = re.sub(r"http\S+", " ", (text or "").lower())
    text = text.replace("n't", "nt")
    return _TOKEN.findall(text)

def score_text(text: str) -> dict:
    """Score one piece of text with real SenticNet. See module docstring."""
    if not available():
        return {
            "available": False,
            "error": _load_error,
            "polarity": None,
            "sentics": None,
            "moodtags": [],
            "concepts": [],
            "n_tokens": 0,
            "n_matched": 0,
            "coverage": 0.0,
            "dominant_dimension": None,
        }

    tokens = _tokens(text)
    content_idx = {i for i, t in enumerate(tokens) if t not in _STOP and len(t) >= 3}
    concepts: list[dict] = []
    matched_content = 0

    i = 0
    while i < len(tokens):
        hit = None
        for n in range(min(MAX_NGRAM, len(tokens) - i), 0, -1):
            words = tokens[i : i + n]
            if n == 1 and (words[0] in _STOP or len(words[0]) < 3):
                continue
            found = _lookup(words)
            if found:
                hit = (n, *found)
                break
        if not hit:
            i += 1
            continue

        n, key, row = hit
        negated = any(t in _NEGATORS for t in tokens[max(0, i - 2) : i])
        sign = -1.0 if negated else 1.0
        sentics = {d: round(sign * _num(row[k]), 3) for k, d in enumerate(DIMENSIONS)}
        concepts.append({
            "concept": key.replace("_", " "),
            "polarity": round(sign * _num(row[7]), 3),
            "sentics": sentics,
            "moodtags": [m for m in row[4:6] if m],
            "negated": negated,
        })
        matched_content += sum(1 for j in range(i, i + n) if j in content_idx)
        i += n

    n_content = len(content_idx)
    coverage = matched_content / n_content if n_content else 0.0

    if concepts:
        polarity = sum(c["polarity"] for c in concepts) / len(concepts)
        sentics = {d: sum(c["sentics"][d] for c in concepts) / len(concepts) for d in DIMENSIONS}
        mood_counts = Counter(m for c in concepts if not c["negated"] for m in c["moodtags"])
        dominant = max(DIMENSIONS, key=lambda d: abs(sentics[d]))
        sentics = {d: round(v, 3) for d, v in sentics.items()}
        if all(v == 0 for v in sentics.values()):
            dominant = None
    else:
        polarity, sentics, mood_counts, dominant = None, None, Counter(), None

    return {
        "available": True,
        "error": None,
        "polarity": None if polarity is None else round(max(-1.0, min(1.0, polarity)), 3),
        "sentics": sentics,
        "moodtags": [m for m, _ in mood_counts.most_common(3)],
        "concepts": concepts,
        "n_tokens": n_content,
        "n_matched": matched_content,
        "coverage": round(coverage, 3),
        "dominant_dimension": dominant,
    }

def usable(result: dict, min_coverage: float | None = None) -> bool:
    """True when a SenticNet result is trustworthy enough to be used as the score."""
    threshold = MIN_COVERAGE if min_coverage is None else min_coverage
    return bool(result.get("available")) and result.get("polarity") is not None \
        and result.get("coverage", 0.0) >= threshold

def dominant_dimension(sentics: dict | None) -> str | None:
    """Return the strongest Hourglass dimension from a SenticNet result."""
    if not sentics or all(value == 0 for value in sentics.values()):
        return None
    return max(DIMENSIONS, key=lambda dimension: abs(sentics[dimension]))
