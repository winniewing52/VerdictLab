from __future__ import annotations

import re

from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from . import sentic

DIMENSIONS = sentic.DIMENSIONS
COVERAGE_THRESHOLD = sentic.MIN_COVERAGE
SENTIC_LABEL_THRESHOLD = 0.1
VADER_LABEL_THRESHOLD = 0.2

_vader = SentimentIntensityAnalyzer()

def analyse_text(text: str) -> dict:
    text = re.sub(r"http\S+", "", text or "")
    text = re.sub(r"\s+", " ", text).strip()

    vader = _vader.polarity_scores(text)["compound"]
    textblob = TextBlob(text).sentiment.polarity

    sn = sentic.score_text(text)
    available = bool(sn["available"])
    if not available:
        raise RuntimeError(f"SenticNet is unavailable: {sn['error']}")
    use_sentic = sentic.usable(sn)

    polarity = sn["polarity"] if use_sentic else vader
    threshold = SENTIC_LABEL_THRESHOLD if use_sentic else VADER_LABEL_THRESHOLD
    label = "positive" if polarity > threshold else "negative" if polarity < -threshold else "neutral"


    hourglass = None
    if sn["sentics"]:
        hourglass = {d: round((sn["sentics"][d] + 1) / 2, 3) for d in DIMENSIONS}

    emotion = sentic.dominant_dimension(sn["sentics"])
    emotion_source = "senticnet" if emotion else "not_available"

    return {
        "text_length": len(text),
        "senticnet": sn["polarity"],
        "vader": round(vader, 3),
        "textblob": round(textblob, 3),
        "hourglass": hourglass,
        "dominant_emotion": emotion,
        "emotion_source": emotion_source,
        "moodtags": sn["moodtags"] if use_sentic else [],
        "label": label,
        "engine": "senticnet" if use_sentic else "vader_fallback",
        "matched_concepts": sn["concepts"],
        "coverage_pct": round(sn["coverage"] * 100),
        "coverage_threshold_pct": round(COVERAGE_THRESHOLD * 100),
        "fell_back_to_vader": not use_sentic,
        "senticnet_available": available,
        "coverage_source": "senticnet",
    }
