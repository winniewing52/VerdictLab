from __future__ import annotations

import re
import os
from collections import Counter, defaultdict
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from ..database import SessionLocal
from ..models import Analysis
from . import ingest
from . import privacy
from . import sentic

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to",
    "of", "in", "on", "for", "it", "this", "that", "with", "as", "at", "be",
    "i", "you", "he", "she", "they", "we", "not", "so", "if", "than", "then",
    "just", "like", "have", "has", "had", "do", "does", "did", "im", "its",
}

_vader = SentimentIntensityAnalyzer()

VADER_LABEL_THRESHOLD = 0.2
SENTIC_LABEL_THRESHOLD = 0.1
SCORING_ENGINE = "SenticNet 9 (sentic 0.0.9)"
MIN_VOLATILITY_N = 5

def _largest_remainder_percentages(counts: dict[str, int]) -> dict[str, float]:
    total = sum(counts.values())
    if not total:
        return {key: 0.0 for key in counts}
    raw = {key: 1000 * value / total for key, value in counts.items()}
    floors = {key: int(value) for key, value in raw.items()}
    remainder = 1000 - sum(floors.values())
    order = sorted(counts, key=lambda key: (raw[key] - floors[key], -list(counts).index(key)), reverse=True)
    for key in order[:remainder]:
        floors[key] += 1
    return {key: value / 10 for key, value in floors.items()}
def _set_stage(db: Session, analysis: Analysis, key: str, label: str, progress: int, status: str):
    stages = dict(analysis.stages or {})
    stages[key] = {"label": label, "progress": progress, "status": status}
    analysis.stages = stages
    analysis.updated_at = datetime.utcnow()
    db.add(analysis)
    db.commit()

def _clean(text: str) -> str:
    """Text used for scoring and de-duplication (identical in every privacy mode)."""
    return privacy.scoring_text(text)

def _record_text(record) -> str:
    return record.get("text", "") if isinstance(record, dict) else record

def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _sentiment_bucket(value: str, fallback: str) -> str:
    label = value.strip().lower()
    if "positive" in label:
        return "positive"
    if "negative" in label:
        return "negative"
    if "neutral" in label:
        return "neutral"
    return fallback

def _date_key(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.date().isoformat()
    text = str(value).strip()
    if not text or text.lower() in ("nan", "nat", "none"):
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        pass
    match = re.match(r"(\d{4}-\d{2}-\d{2})", text)
    if match:
        return match.group(1)
    try:
        parsed = pd.to_datetime(text, errors="raise", utc=True)
        return parsed.date().isoformat()
    except Exception:
        return None

def _datetime_key(value) -> str | None:
    """Wall-clock timestamp ('YYYY-MM-DDTHH:MM:SS') exactly as the file states it, so the UI can
    plot by time of day when a file only covers one date. Same parsing rules as _date_key."""
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        if value.tzinfo is not None:
            value = value.tz_localize(None)
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    text = str(value).strip()
    if not text or text.lower() in ("nan", "nat", "none"):
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        pass
    try:
        parsed = pd.to_datetime(text, errors="raise", utc=True)
        return parsed.tz_localize(None).strftime("%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None

def _subreddit_key(value) -> str:
    """Lower-cased identity for a subreddit, so 'r/WorldNews', '/r/worldnews/'
    and 'worldnews' are all treated as the same community."""
    text = str(value or "").strip().lower()
    text = re.sub(r"^https?://(www\.|old\.)?reddit\.com", "", text)
    return text.strip("/").removeprefix("r/").strip("/")

def _subreddit_label(value) -> str | None:
    """Tidy display name for a raw subreddit value (None when empty)."""
    text = str(value).strip() if value not in (None, "") else ""
    if not text or text.lower() in ("nan", "none"):
        return None
    text = re.sub(r"^https?://(www\.|old\.)?reddit\.com", "", text, flags=re.I).strip("/")
    return text or None

def _detect_subreddits(records: list[dict]) -> list[dict]:
    """Every distinct subreddit actually present in the data, most active first.
    Computed over ALL cleaned records (not just the stored sample)."""
    counts: Counter = Counter()
    labels: dict[str, str] = {}
    for record in records:
        label = _subreddit_label(record.get("subreddit"))
        if not label:
            continue
        key = _subreddit_key(label)
        if not key:
            continue
        labels.setdefault(key, label)
        counts[key] += 1
    return [{"name": labels[key], "count": count} for key, count in counts.most_common()]

def _conflict_name(record: dict) -> str | None:
    text = f"{record.get('subreddit', '')} {_record_text(record)}".lower()
    subreddit = _subreddit_key(record.get("subreddit"))
    community_hints = {
        "israelpalestine": "Israel-Gaza", "israel": "Israel-Gaza",
        "ukraine": "Ukraine-Russia", "ukrainerussia": "Ukraine-Russia",
    }
    if subreddit in community_hints:
        return community_hints[subreddit]
    conflict_terms = {
        "Israel-Gaza": (("israel", "israeli", "palestin", "gaza", "hamas", "west bank", "idf"),
                        ("war", "conflict", "ceasefire", "hostage", "bomb", "occupation", "settlement")),
        "Ukraine-Russia": (("ukraine", "ukrainian", "russia", "russian", "zelensky"),
                           ("war", "invasion", "front", "missile", "ceasefire")),
        "US-Iran": (("iran", "iranian", "tehran"), ("war", "nuclear", "sanction", "strike", "conflict")),
        "Afghanistan": (("afghanistan", "afghan", "taliban"), ("war", "troop", "conflict", "attack")),
        "Syria": (("syria", "syrian"), ("war", "refugee", "conflict", "attack")),
        "Yemen": (("yemen", "houthi"), ("war", "airstrike", "conflict", "attack")),
    }
    matches = []
    for name, (entities, context) in conflict_terms.items():
        entity_hits = sum(bool(re.search(rf"\b{re.escape(term)}\w*\b", text)) for term in entities)
        context_hits = sum(bool(re.search(rf"\b{re.escape(term)}\w*\b", text)) for term in context)
        if entity_hits and context_hits:
            matches.append((name, entity_hits + context_hits))
    return max(matches, key=lambda item: item[1])[0] if matches else None

def run_pipeline(
    analysis_id: str,
    file_bytes: bytes | None = None,
    filename: str | None = None,
    file_path: str | None = None,
):
    db = SessionLocal()
    try:
        analysis = db.get(Analysis, analysis_id)
        if not analysis:
            return

        analysis.status = "running"
        db.add(analysis)
        db.commit()


        if not sentic.available():
            analysis.status = "failed"
            analysis.error = (
                "SenticNet is not installed on the server, so no analysis was run. "
                "Run: pip install sentic  (details: " + str(sentic.load_error()) + ")"
            )
            db.add(analysis)
            db.commit()
            return


        _set_stage(db, analysis, "collecting_content", "Collecting content", 5, "running")
        try:
            if analysis.source_type == "reddit":
                records = ingest.ingest_reddit(analysis.source_url)
            elif analysis.source_type == "youtube":
                records = ingest.ingest_youtube(analysis.source_url)
            elif analysis.source_type == "csv" and (file_bytes or file_path):
                records = ingest.ingest_file(
                    file_path or file_bytes,
                    filename or analysis.uploaded_filename,
                )
            else:
                records = []
        except Exception as exc:
            analysis.status = "failed"
            analysis.error = f"Couldn't collect content: {exc}"
            db.add(analysis)
            db.commit()
            return

        analysis.records_in = len(records)
        db.add(analysis)
        db.commit()
        _set_stage(db, analysis, "collecting_content", "Collecting content", 100, "done")

        if not records:
            analysis.status = "failed"
            analysis.error = "No records found at that source."
            db.add(analysis)
            db.commit()
            return


        _set_stage(db, analysis, "cleaning_dedup", "Cleaning & dedup", 10, "running")
        privacy_mode = analysis.privacy_mode if analysis.privacy_mode in privacy.MODES else "redacted"
        redaction_totals: Counter = Counter()
        removed_by_reason: Counter = Counter()
        cleaned, seen = [], set()
        for i, r in enumerate(records):
            original = _record_text(r)
            c = _clean(original)
            if not c:
                removed_by_reason["empty_after_cleaning"] += 1
            elif len(c) <= 3:
                removed_by_reason["three_characters_or_fewer"] += 1
            elif c.lower() in seen:
                removed_by_reason["duplicate"] += 1
            else:
                seen.add(c.lower())
                stored_text, redaction_counts = privacy.apply_privacy(original, privacy_mode)
                redaction_totals.update(redaction_counts)
                cleaned.append({
                    "text": c,
                    "display": stored_text,
                    "metadata": r if isinstance(r, dict) else {},
                })
            if i % max(1, len(records) // 5) == 0:
                pct = int(min(95, (i / max(1, len(records))) * 100))
                _set_stage(db, analysis, "cleaning_dedup", "Cleaning & dedup", pct, "running")
        _set_stage(db, analysis, "cleaning_dedup", "Cleaning & dedup", 100, "done")

        dedup_rate = round(100 * (1 - len(cleaned) / max(1, len(records))), 1)


        analysis.quality_score = None
        db.add(analysis)
        db.commit()


        _set_stage(db, analysis, "model_comparison", "Model comparison", 5, "running")
        scored = []
        for i, item in enumerate(cleaned):
            text = item["text"]
            metadata = item["metadata"]

            # Large scored exports commonly already contain the model outputs.
            # Reusing them avoids running three Python NLP models once per row.
            # Emotion still requires SenticNet sentic vectors, which these
            # exports do not provide, so it remains explicitly unavailable.
            has_precomputed = (
                _number(metadata.get("sentic_polarity")) is not None
                and _number(metadata.get("vader_compound")) is not None
            )
            if has_precomputed:
                sn = {
                    "polarity": _number(metadata.get("sentic_polarity")) or 0.0,
                    "coverage": 0.0,
                    "n_tokens": 0,
                    "n_matched": 0,
                    "concepts": [],
                    "sentics": None,
                    "moodtags": [],
                }
                use_sn = False
                vader = _number(metadata.get("vader_compound")) or 0.0
                textblob = None
            else:
                sn = sentic.score_text(text)
                use_sn = sentic.usable(sn)
                vader = _vader.polarity_scores(text)["compound"]
                textblob = TextBlob(text).sentiment.polarity


            polarity = sn["polarity"] if use_sn else vader
            engine = "senticnet" if use_sn else ("precomputed" if has_precomputed else "vader_fallback")
            threshold = SENTIC_LABEL_THRESHOLD if use_sn else VADER_LABEL_THRESHOLD
            label = "positive" if polarity > threshold else "negative" if polarity < -threshold else "neutral"
            vader_label = "positive" if vader > VADER_LABEL_THRESHOLD else "negative" if vader < -VADER_LABEL_THRESHOLD else "neutral"
            emotion, emotion_source = _emotion(sn)

            scored.append({
                "text": item["display"][:500],
                "vader_score": round(vader, 3),
                "textblob_score": round(textblob, 3),


                "source_polarity": round(polarity, 3),
                "source_label": label,
                "engine": engine,
                "sentic_coverage": None if has_precomputed else sn["coverage"],
                "sentic_concepts": [c["concept"] for c in sn["concepts"][:8]],
                "sentics": sn["sentics"] if use_sn else None,
                "moodtags": sn["moodtags"] if use_sn else [],

                "file_polarity": _number(metadata.get("sentic_polarity")),
                "event_date": _date_key(metadata.get("created_time")),

                "event_time": _datetime_key(metadata.get("created_time")),
                "conflict": _conflict_name({**metadata, "text": text}),

                "subreddit": _subreddit_label(metadata.get("subreddit")),

                "kind": _kind(metadata.get("kind")),
                "upvotes": _upvotes(metadata.get("upvotes")),
                "emotion": emotion,
                "emotion_source": emotion_source,
                "label": vader_label,
                "explanation": "Precomputed polarity supplied by the input file."
                if has_precomputed else _explain(sn if use_sn else None, polarity, vader),
            })
            if i % max(1, len(cleaned) // 8) == 0:
                pct = int(min(95, (i / max(1, len(cleaned))) * 100))
                _set_stage(db, analysis, "model_comparison", "Model comparison", pct, "running")
        words = re.findall(r"[a-zA-Z']{4,}", " ".join(item["text"] for item in cleaned).lower())
        words = [w for w in words if w not in STOPWORDS]
        top_topics = [w for w, _ in Counter(words).most_common(10)]

        counts = Counter(s["source_label"] for s in scored)
        total = len(scored) or 1
        conflict_counts = Counter()
        daily_polarity = defaultdict(list)
        emotion_counts = Counter()
        for item, score in zip(cleaned, scored):
            metadata = item["metadata"]
            conflict = _conflict_name({**metadata, "text": item["text"]})
            if conflict:
                conflict_counts[conflict] += 1
            date = _date_key(metadata.get("created_time"))
            if date:
                daily_polarity[date].append(score["source_polarity"])
            emotion_counts[score["emotion"]] += 1
        volatile_day = max(
            daily_polarity.items(),
            key=lambda entry: (max(entry[1]) - min(entry[1])) if len(entry[1]) >= MIN_VOLATILITY_N else -1,
            default=(None, []),
        )
        volatile_spread = round(max(volatile_day[1]) - min(volatile_day[1]), 3) if len(volatile_day[1]) >= MIN_VOLATILITY_N else None
        trend_dates = sorted(daily_polarity.keys())
        daily_avg_polarity = {date: sum(values) / len(values) for date, values in daily_polarity.items()}
        daily_volume = {date: len(values) for date, values in daily_polarity.items()}
        rolling_window = 3
        polarity_trend: list[float] = []
        volume_trend: list[int] = []
        for index, date in enumerate(trend_dates):
            window_dates = trend_dates[max(0, index - rolling_window + 1): index + 1]
            window_values = [daily_avg_polarity[d] for d in window_dates]
            polarity_trend.append(round(sum(window_values) / len(window_values), 3))
            volume_trend.append(daily_volume[date])
        if len(trend_dates) > 180:
            step = (len(trend_dates) - 1) / 179
            sample_indices = [round(index * step) for index in range(180)]
            trend_dates = [trend_dates[i] for i in sample_indices]
            polarity_trend = [polarity_trend[i] for i in sample_indices]
            volume_trend = [volume_trend[i] for i in sample_indices]
        summary = {
            "total_records": len(records),
            "records_after_dedup": len(cleaned),
            "dedup_rate_pct": dedup_rate,
            "sentiment_breakdown": _largest_remainder_percentages({
                "positive": counts.get("positive", 0),
                "neutral": counts.get("neutral", 0),
                "negative": counts.get("negative", 0),
            }),
            "avg_vader_score": round(sum(s["vader_score"] for s in scored) / total, 3) if scored else None,
            "avg_textblob_score": (
                round(sum(s["textblob_score"] for s in scored if s["textblob_score"] is not None) /
                      sum(s["textblob_score"] is not None for s in scored), 3)
                if any(s["textblob_score"] is not None for s in scored) else None
            ),
            "avg_source_polarity": round(sum(s["source_polarity"] for s in scored) / total, 3),

            "scoring": _scoring_audit(scored),
            "privacy": {
                "mode": privacy_mode,
                "redactions_applied": {k: int(redaction_totals.get(k, 0)) for k in ("emails", "phones", "handles", "urls")},
                "note": (
                    "Stored text has emails, phone numbers, usernames and links replaced with placeholders."
                    if privacy_mode == "redacted"
                    else "Stored text is kept as written. Scores are identical in both modes."
                ),
            },
            "evaluation": {
                "status": "not_configured",
                "message": "No independently labelled evaluation dataset is configured. "
                           "Do not report accuracy from this analysis.",
            },
            "top_conflict": conflict_counts.most_common(1)[0][0] if conflict_counts else "Not available",
            "dominant_emotion": emotion_counts.most_common(1)[0][0] if emotion_counts else "Not available",
            "most_volatile_day": volatile_day[0] or "Not available",
            "most_volatile_spread": volatile_spread,
            "most_volatile_n": len(volatile_day[1]) if volatile_spread is not None else None,
            "top_topics": top_topics,
            "quality_score": None,
            "data_quality": {
                "records_in": len(records),
                "records_after_dedup": len(cleaned),
                "dedup_rate_pct": dedup_rate,
                "interpretation": "Input hygiene only; not a model accuracy score.",
                "removed_by_reason": dict(removed_by_reason),
            },
            "polarity_trend": polarity_trend,
            "trend_dates": trend_dates,
            "volume_trend": volume_trend,

            "subreddits": _detect_subreddits([item["metadata"] for item in cleaned]),
            "stored_sample_size": min(len(scored), MAX_STORED_RECORDS),

            "kind_breakdown": _kind_breakdown(scored),
        }

        analysis.result_summary = summary
        analysis.result_records = _representative_sample(scored, MAX_STORED_RECORDS)
        analysis.report_markdown = _build_report(analysis, summary, top_topics)
        # Keep the visible stage honest while the final summary and sample are
        # still being built. The analysis must not look complete until results
        # and the report have been persisted.
        _set_stage(db, analysis, "model_comparison", "Model comparison", 100, "done")
        analysis.status = "complete"
        db.add(analysis)
        db.commit()

    except Exception as exc:
        analysis = db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = "failed"
            analysis.error = f"Analysis failed: {exc}"
            db.add(analysis)
            db.commit()
    finally:
        db.close()
        if file_path:
            try:
                os.unlink(file_path)
            except FileNotFoundError:
                pass

MAX_STORED_RECORDS = 5000

def _representative_sample(scored: list[dict], limit: int) -> list[dict]:
    """Evenly spaced pick across the date-ordered records (undated last), so every date,
    subreddit and conflict in the file is represented in proportion to its size."""
    if len(scored) <= limit:
        return scored
    ordered = sorted(scored, key=lambda item: (item.get("event_date") is None, item.get("event_time") or item.get("event_date") or ""))
    step = len(ordered) / limit
    return [ordered[int(i * step)] for i in range(limit)]

def _kind(value) -> str:
    label = str(value or "").strip().lower()
    return label if label in ("post", "comment") else "unknown"

def _kind_breakdown(scored: list[dict]) -> dict:
    """Per kind (post / comment / unknown): count, average polarity and sentiment split."""
    out: dict = {}
    for kind in ("post", "comment", "unknown"):
        items = [s for s in scored if s["kind"] == kind]
        if not items:
            continue
        n = len(items)
        share = lambda label: round(100 * sum(1 for s in items if s["source_label"] == label) / n, 1)
        out[kind] = {
            "count": n,
            "avg_polarity": round(sum(s["source_polarity"] for s in items) / n, 3),
            "positive": share("positive"),
            "neutral": share("neutral"),
            "negative": share("negative"),
        }
    return out

def _upvotes(value):
    number = _number(value)
    return int(number) if number is not None and number == number and abs(number) != float("inf") else None

def _emotion(sn: dict) -> tuple[str, str]:
    """Return the Hourglass dimension derived from SenticNet sentics."""
    dimension = sentic.dominant_dimension(sn.get("sentics"))
    return (dimension, "senticnet") if dimension else ("unknown", "not_available")

def _explain(sn: dict | None, polarity: float, vader_score: float) -> str:
    """Say which SenticNet concepts drove the score (or that VADER was used instead)."""
    if sn:
        strongest = sorted(sn["concepts"], key=lambda c: abs(c["polarity"]), reverse=True)[:3]
        parts = ", ".join(f"{c['concept']} ({c['polarity']:+.2f})" for c in strongest)
        return f"SenticNet matched {sn['n_matched']}/{sn['n_tokens']} content words. Strongest concepts: {parts}."
    tone = "positive" if vader_score > VADER_LABEL_THRESHOLD else "negative" if vader_score < -VADER_LABEL_THRESHOLD else "neutral"
    return f"Too few SenticNet concepts matched, so VADER was used instead ({tone}, {vader_score:+.2f})."

def _scoring_audit(scored: list[dict]) -> dict:
    n = len(scored) or 1
    used = [s for s in scored if s["engine"] == "senticnet"]
    precomputed = [s for s in scored if s["engine"] == "precomputed"]
    fallback = [s for s in scored if s["engine"] == "vader_fallback"]
    coverages = [s["sentic_coverage"] for s in scored if s["sentic_coverage"] is not None]
    return {
        "engine": SCORING_ENGINE,
        "records_scored_by_senticnet": len(used),
        "records_precomputed": len(precomputed),
        "records_vader_fallback": len(fallback),
        "senticnet_usable_pct": round(100 * len(used) / n, 1),
        "mean_concept_coverage_pct": (
            round(100 * sum(coverages) / len(coverages), 1)
            if coverages else None
        ),
        "min_coverage_threshold_pct": round(100 * sentic.MIN_COVERAGE),
        "emotion_sources": dict(Counter(s["emotion_source"] for s in scored)),
    }

def _build_report(analysis: Analysis, summary: dict, topics: list[str]) -> str:
    sb = summary["sentiment_breakdown"]
    return f"""# {analysis.title}

**Source:** {analysis.source_type} - {analysis.source_url or "uploaded file"}
**Analysis reference:** {analysis.id}
**Records collected:** {summary['total_records']} -> **{summary['records_after_dedup']}** after cleaning/dedup ({summary['dedup_rate_pct']}% removed)
**Model quality:** not reported without an independently labelled evaluation set.
**Privacy mode:** {summary['privacy']['mode']} ({summary['privacy']['note']})

## Sentiment breakdown
- Positive: {sb['positive']}%
- Neutral: {sb['neutral']}%
- Negative: {sb['negative']}%

Average VADER compound score: {summary['avg_vader_score'] if summary['avg_vader_score'] is not None else "Not available"} | Average TextBlob polarity: {summary['avg_textblob_score'] if summary['avg_textblob_score'] is not None else "Not available"}

## Top discussion topics
{", ".join(topics) if topics else "Not enough signal to extract topics."}

## Methodology
Every record scored by SenticNet used SenticNet 9 (concept-level lookup with
multi-word concepts, polarity and the four Hourglass dimensions). Records where fewer
than {int(sentic.MIN_COVERAGE * 100)}% of the content words were found in SenticNet fall back to VADER and are
flagged as such. VADER and TextBlob were also run on every record as baselines so scores
can be cross-checked. Each record's explanation lists the SenticNet concepts behind its score.
Rows with supplied polarity columns are reported as precomputed and do not have
SenticNet concept coverage or Hourglass vectors available.

## SenticNet coverage
- Scored by SenticNet: {summary['scoring']['senticnet_usable_pct']}% of records
- Precomputed scores reused: {summary['scoring'].get('records_precomputed', 0)} records
- VADER fallback: {summary['scoring']['records_vader_fallback']} records
- Mean concept coverage: {summary['scoring']['mean_concept_coverage_pct'] if summary['scoring']['mean_concept_coverage_pct'] is not None else "Not available"}%
"""
