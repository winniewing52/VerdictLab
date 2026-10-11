"""Evaluation on an independently labelled, user-supplied dataset.

This deliberately does not ship fabricated labels or report a score from the
application's production data. The evaluator requires a text column and a
human label column, and returns reproducible per-class metrics.
"""
from __future__ import annotations

from io import BytesIO
import random
from collections import defaultdict

import pandas as pd
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from . import sentic
from .pipeline import SENTIC_LABEL_THRESHOLD, VADER_LABEL_THRESHOLD

LABELS = ("positive", "neutral", "negative")
_vader = SentimentIntensityAnalyzer()


def _label(value: object) -> str | None:
    text = str(value or "").strip().lower()
    aliases = {"pos": "positive", "neg": "negative", "neu": "neutral"}
    text = aliases.get(text, text)
    return text if text in LABELS else None


def _predictions(text: str) -> dict[str, str]:
    sn = sentic.score_text(text)
    polarity = sn["polarity"]
    sentic_label = (
        "positive" if polarity is not None and polarity > SENTIC_LABEL_THRESHOLD
        else "negative" if polarity is not None and polarity < -SENTIC_LABEL_THRESHOLD
        else "neutral"
    )
    vader = _vader.polarity_scores(text)["compound"]
    vader_label = "positive" if vader > VADER_LABEL_THRESHOLD else "negative" if vader < -VADER_LABEL_THRESHOLD else "neutral"
    blob = TextBlob(text).sentiment.polarity
    blob_label = "positive" if blob > SENTIC_LABEL_THRESHOLD else "negative" if blob < -SENTIC_LABEL_THRESHOLD else "neutral"
    return {"senticnet": sentic_label, "vader": vader_label, "textblob": blob_label}


def _metrics(actual: list[str], predicted: list[str]) -> dict:
    confusion = {actual_label: {predicted_label: 0 for predicted_label in LABELS} for actual_label in LABELS}
    for truth, guess in zip(actual, predicted):
        confusion[truth][guess] += 1
    per_class = {}
    for label in LABELS:
        tp = confusion[label][label]
        fp = sum(confusion[other][label] for other in LABELS if other != label)
        fn = sum(confusion[label][other] for other in LABELS if other != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}
    macro_f1 = sum(row["f1"] for row in per_class.values()) / len(LABELS)
    return {
        "accuracy": round(sum(a == p for a, p in zip(actual, predicted)) / len(actual), 4),
        "macro_f1": round(macro_f1, 4),
        "per_class": per_class,
        "confusion_matrix": confusion,
    }


def _bootstrap_intervals(
    actual: list[str], predictions: list[str], samples: int = 2000, seed: int = 17
) -> dict:
    """Return deterministic percentile bootstrap 95% CIs for the reported metrics."""
    rng = random.Random(seed)
    values: dict[str, list[float]] = defaultdict(list)
    if not actual:
        return {}
    for _ in range(samples):
        indices = [rng.randrange(len(actual)) for _ in actual]
        sampled_actual = [actual[i] for i in indices]
        sampled_predictions = [predictions[i] for i in indices]
        metric = _metrics(sampled_actual, sampled_predictions)
        values["accuracy"].append(metric["accuracy"])
        values["macro_f1"].append(metric["macro_f1"])
        for label in LABELS:
            for name in ("precision", "recall", "f1"):
                values[f"{label}.{name}"].append(metric["per_class"][label][name])
    return {
        name: [round(float(pd.Series(scores).quantile(q)), 4) for q in (0.025, 0.975)]
        for name, scores in values.items()
    }


def _slice_metrics(actual: list[str], predictions: list[str], lengths: list[int]) -> dict:
    """Compare short and long text without selecting a slice after seeing scores."""
    slices = {
        "short_0_80_chars": [i for i, length in enumerate(lengths) if length <= 80],
        "long_81_plus_chars": [i for i, length in enumerate(lengths) if length > 80],
    }
    result = {}
    for name, indices in slices.items():
        if not indices:
            continue
        result[name] = {
            "records": len(indices),
            **_metrics([actual[i] for i in indices], [predictions[i] for i in indices]),
        }
    return result


def evaluate_csv(file_bytes: bytes, filename: str | None, text_column: str | None, label_column: str | None,
                 dataset_name: str, citation: str | None) -> dict:
    if filename and filename.lower().endswith((".xls", ".xlsx")):
        frame = pd.read_excel(BytesIO(file_bytes))
    else:
        frame = pd.read_csv(BytesIO(file_bytes))
    columns = {str(column).strip().lower(): column for column in frame.columns}
    text_key = columns.get((text_column or "").strip().lower()) if text_column else next(
        (columns[name] for name in ("text", "comment", "content", "sentence") if name in columns), None)
    label_key = columns.get((label_column or "").strip().lower()) if label_column else next(
        (columns[name] for name in ("label", "sentiment", "gold", "human_label") if name in columns), None)
    if text_key is None or label_key is None:
        raise ValueError("A text column and a human label column are required.")
    actual: list[str] = []
    lengths: list[int] = []
    predictions = {name: [] for name in ("senticnet", "vader", "textblob")}
    skipped = 0
    for _, row in frame.iterrows():
        truth = _label(row[label_key])
        text = str(row[text_key]).strip()
        if truth is None or not text or text.lower() == "nan":
            skipped += 1
            continue
        actual.append(truth)
        lengths.append(len(text))
        for name, prediction in _predictions(text).items():
            predictions[name].append(prediction)
    if len(actual) < 100:
        raise ValueError(f"At least 100 valid labelled records are required; found {len(actual)}.")
    models = {}
    for name, guessed in predictions.items():
        models[name] = {
            **_metrics(actual, guessed),
            "confidence_intervals_95": _bootstrap_intervals(actual, guessed),
            "text_length_slices": _slice_metrics(actual, guessed, lengths),
        }
    return {
        "dataset": {"name": dataset_name, "records": len(actual), "skipped": skipped, "text_column": str(text_key), "label_column": str(label_key)},
        "protocol": {
            "labels": list(LABELS),
            "bootstrap_samples": 2000,
            "bootstrap_seed": 17,
            "slice_definition": "short_0_80_chars vs long_81_plus_chars",
            "note": "Intervals are percentile bootstrap 95% confidence intervals over rows; no tuning is performed on this test set.",
        },
        "models": models,
        "published_benchmark": {
            "status": "reference_required",
            "name": "TweetEval sentiment (Barbieri et al., 2020)",
            "citation": citation or "Barbieri et al. (2020), TweetEval: Unified Benchmark and Comparative Evaluation for Tweet Classification.",
            "comparison": None,
        },
    }
