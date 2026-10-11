from __future__ import annotations

import argparse
import csv
import io
import json
import random
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = "https://raw.githubusercontent.com/cardiffnlp/tweeteval/main/datasets/sentiment"
LABELS = {"0": "negative", "1": "neutral", "2": "positive"}
CITATION = (
    "Barbieri, F., Camacho-Collados, J., Espinosa Anke, L., Neves, L. (2020). TweetEval: Unified "
    "Benchmark and Comparative Evaluation for Tweet Classification. Findings of EMNLP 2020."
)
OUT_DIR = BACKEND / "benchmarks"

def fetch(name: str) -> list[str]:
    with urllib.request.urlopen(f"{BASE}/{name}", timeout=60) as response:
        return response.read().decode("utf-8").splitlines()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None,
                        help="score only a seeded random subset (smoke test; do not report these numbers)")
    args = parser.parse_args()

    from app.services import sentic
    from app.services.evaluation import evaluate_csv

    if not sentic.available():
        print(f"ERROR: SenticNet is not available ({sentic.load_error()}). Run: pip install sentic", file=sys.stderr)
        return 1

    print("Downloading TweetEval sentiment test split ...")
    texts, labels = fetch("test_text.txt"), fetch("test_labels.txt")
    if len(texts) != len(labels):
        print(f"ERROR: {len(texts)} texts but {len(labels)} labels", file=sys.stderr)
        return 1
    rows = [(text, LABELS[label.strip()]) for text, label in zip(texts, labels)]
    full_size = len(rows)
    if args.limit and args.limit < len(rows):
        rows = random.Random(17).sample(rows, args.limit)
        print(f"SMOKE RUN on {len(rows)} of {full_size} rows. Do not report these numbers.")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["text", "label"])
    writer.writerows(rows)

    print(f"Scoring {len(rows)} tweets with SenticNet, VADER and TextBlob (bootstrap CIs take a while) ...")
    started = time.time()
    result = evaluate_csv(
        buffer.getvalue().encode("utf-8"), "tweeteval_sentiment_test.csv",
        "text", "label", "TweetEval sentiment, official test split", CITATION,
    )
    result["run"] = {
        "script": "scripts/run_benchmark.py",
        "source": BASE,
        "rows_scored": len(rows),
        "rows_in_official_test_split": full_size,
        "is_full_split": len(rows) == full_size,
        "seconds": round(time.time() - started, 1),
        "completed_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sentic_min_coverage": sentic.MIN_COVERAGE,
    }
    result["published_benchmark"]["status"] = "evaluated_on_official_test_split" if result["run"]["is_full_split"] else "smoke_run_only"

    OUT_DIR.mkdir(exist_ok=True)
    stem = "tweeteval_sentiment_test" if result["run"]["is_full_split"] else "tweeteval_sentiment_SMOKE"
    (OUT_DIR / f"{stem}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    lines = [
        f"# TweetEval sentiment, official test split ({len(rows)} tweets)",
        "",
        f"Run at {result['run']['completed_at_utc']} UTC. No threshold tuning. Reference: {CITATION}",
        "",
        "| Model | Accuracy | 95% CI | Macro-F1 | 95% CI |",
        "|---|---|---|---|---|",
    ]
    for name, model in result["models"].items():
        ci = model["confidence_intervals_95"]
        lines.append(
            f"| {name} | {model['accuracy']:.3f} | {ci['accuracy'][0]:.3f}-{ci['accuracy'][1]:.3f} "
            f"| {model['macro_f1']:.3f} | {ci['macro_f1'][0]:.3f}-{ci['macro_f1'][1]:.3f} |"
        )
    lines += ["", "Full per-class metrics, confusion matrices and length slices are in the JSON file next to this one.", ""]
    (OUT_DIR / f"{stem}.md").write_text("\n".join(lines), encoding="utf-8")

    print("\n".join(lines))
    print(f"Wrote {OUT_DIR / (stem + '.json')} and {OUT_DIR / (stem + '.md')}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
