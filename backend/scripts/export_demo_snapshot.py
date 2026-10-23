"""Export an existing analysis through the public API for the offline demo.

Usage:
  python backend/scripts/export_demo_snapshot.py --analysis-id A-... --token ...
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend" / "public" / "demo-snapshot"


def fetch(base_url: str, path: str, token: str | None = None) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{base_url.rstrip('/')}{path}", headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not fetch {path}: {error}") from error


def write_json(name: str, payload: dict) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export exact API responses for the offline demo.")
    parser.add_argument("--analysis-id", required=True)
    parser.add_argument("--token", required=True, help="Session token for the analysis owner.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--sample-size", type=int, default=500)
    args = parser.parse_args()
    if args.sample_size < 1:
        raise SystemExit("--sample-size must be at least 1")

    analysis = fetch(args.base_url, f"/analyses/{args.analysis_id}", args.token)
    results = fetch(args.base_url, f"/analyses/{args.analysis_id}/results", args.token)
    report = fetch(args.base_url, f"/analyses/{args.analysis_id}/report", args.token)
    if analysis.get("status") != "complete" or not results.get("result_summary"):
        raise SystemExit("The selected analysis is not complete or has no result summary.")
    summary = results["result_summary"]
    if summary.get("top_conflict") != "Israel-Gaza":
        raise SystemExit(f"Refusing to export: top conflict is {summary.get('top_conflict')!r}, not 'Israel-Gaza'.")

    records = results.get("result_records") or []
    sample = records[:args.sample_size]
    write_json("analysis.json", analysis)
    write_json("results.json", results)
    write_json("report.json", report)
    write_json("explorer-sample.json", {
        "sample_of": len(sample),
        "total_in_api_response": len(records),
        "total_records_in_analysis": summary.get("total_records"),
        "records": sample,
    })
    (OUTPUT / "README.txt").write_text(
        "Offline demo snapshot\n"
        f"Analysis: {analysis['id']} / {analysis['title']}\n"
        f"Explorer records: sample of {len(sample)} records from {summary.get('total_records')} total records.\n"
        "analysis.json, results.json, and report.json are exact API responses.\n",
        encoding="utf-8",
    )
    print(f"Exported {analysis['id']} to {OUTPUT}")
    print(f"Explorer sample: {len(sample)} of {summary.get('total_records')} total records")


if __name__ == "__main__":
    main()
