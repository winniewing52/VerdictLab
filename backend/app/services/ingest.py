"""
Pulls raw text records from a source. Kept intentionally simple:

- Reddit: public threads can be read as JSON by appending `.json` to the
  URL - no API key needed for read-only access to public posts/comments.
- YouTube: needs a `YOUTUBE_API_KEY` (Data API v3) to fetch comments.
- CSV: any column that looks like it holds text (falls back to the
  first text-like column) is used as the record body.
"""
from __future__ import annotations

import csv
import html
import io
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, time as dt_time
from pathlib import Path

import httpx
import pandas as pd

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "created_time": (
        "created_time", "created_at", "created_utc", "created", "date",
        "timestamp", "datetime", "event_date", "time", "published_at", "posted_at",
    ),
    "subreddit": ("subreddit", "source", "community", "channel"),
    "sentic_label": ("sentic_label",),
    "sentic_polarity": ("sentic_polarity",),
    "vader_compound": ("vader_compound", "vader_score", "compound"),
    "upvotes": ("upvotes", "ups", "score", "likes", "points", "reddit_score"),
    "emotion": ("emotion", "dominant_emotion", "sentic_emotion", "hourglass_dimension"),
}


TIME_ONLY_ALIASES = ("time", "time_of_day", "posted_time", "created_time_of_day", "hour")
TEXT_COLUMN_NAMES = ("text", "comment", "body", "content", "message", "self_text", "comment_text", "review", "tweet", "post")

def _text_likeness(values) -> float:
    """Higher = looks more like free text. IDs such as 'k9tk1p2' have no spaces, so they score 0."""
    vals = [str(v).strip() for v in values if _has_value(v)]
    if not vals:
        return 0.0
    avg_len = sum(len(v) for v in vals) / len(vals)
    spaced = sum(1 for v in vals if " " in v) / len(vals)
    return avg_len * spaced

def _choose_text_column(columns, samples: dict):
    """Pick the column that holds the comment text.
    1) a column with a known text name AND text-like contents,
    2) otherwise the most text-like column overall,
    so an ID column that merely has a text-ish name (or is the longest string) is never chosen."""
    lowered = {str(c).strip().lower(): c for c in columns if c is not None}
    for name in TEXT_COLUMN_NAMES:
        col = lowered.get(name)
        if col is not None and _text_likeness(samples.get(col, [])) >= 5:
            return col
    best = max(columns, key=lambda c: _text_likeness(samples.get(c, [])), default=None)
    if best is not None and _text_likeness(samples.get(best, [])) > 0:
        return best
    return next((lowered[n] for n in TEXT_COLUMN_NAMES if n in lowered), best)

def _clock_text(value) -> str | None:
    """'HH:MM:SS' from a time-like cell (datetime.time, Timestamp or 'H:MM[:SS][ AM/PM]' text), else None."""
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime, dt_time)):
        return None if (isinstance(value, pd.Timestamp) and pd.isna(value)) else value.strftime("%H:%M:%S")
    text = str(value).strip()
    if not re.fullmatch(r"\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*([AaPp][Mm])?", text):
        return None
    try:
        return pd.to_datetime(text).strftime("%H:%M:%S")
    except Exception:
        return None

def _has_clock(value) -> bool:
    if isinstance(value, (pd.Timestamp, datetime)):
        return not (value.hour == value.minute == value.second == 0)
    return bool(re.search(r"\d{1,2}:\d{2}", str(value)))

def _merge_date_time(created, time_value):
    """Combine a date-only created_time with a separate time column ('YYYY-MM-DD' + 'HH:MM:SS')."""
    clock = _clock_text(time_value)
    if clock is None or created is None or _has_clock(created):
        return created
    if isinstance(created, (pd.Timestamp, datetime)):
        day = created.strftime("%Y-%m-%d")
    else:
        try:
            day = pd.to_datetime(str(created).strip()).strftime("%Y-%m-%d")
        except Exception:
            return created
    return f"{day}T{clock}"

def _time_source(columns: dict, created_source):
    """The column holding a separate clock time, if any (never the created_time column itself)."""
    return next((columns[alias] for alias in TIME_ONLY_ALIASES if alias in columns and columns[alias] != created_source), None)


KIND_COLUMNS = ("kind", "type", "record_type", "post_type", "content_type", "item_type", "post_or_comment")
PARENT_COLUMNS = ("parent_id", "link_id", "in_reply_to", "reply_to", "parent_comment_id")
COMMENT_TEXT_NAMES = {"comment", "comment_text", "reply", "body"}
POST_TEXT_NAMES = {"post", "self_text", "selftext"}

def _has_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, float) and value != value:
        return False
    return str(value).strip().lower() not in ("", "nan", "nat", "none", "null", "<na>")

def _kind_from_value(value) -> str | None:
    """Map a cell such as 'Post', 'submission', 't3', 'Comment', 'reply' or 't1' to a kind."""
    if not _has_value(value):
        return None
    label = str(value).strip().lower()
    if label in ("t3", "op") or label.startswith(("post", "submission", "thread")):
        return "post"
    if label in ("t1",) or label.startswith(("comment", "reply")):
        return "comment"
    return None

def _make_kind_detector(columns: dict, sample_rows, text_column):
    """Build a function that decides post/comment/unknown for one uploaded row.

    Order of trust: 1) an explicit type column, 2) parent/link id columns (only
    comments have a parent), 3) the name of the text column ('comment' vs 'post'),
    4) unknown.  `columns` maps lower-cased column name -> real column key.
    """
    kind_col = next((columns[name] for name in KIND_COLUMNS if name in columns), None)
    parent_cols = [columns[name] for name in PARENT_COLUMNS if name in columns]
    text_name = str(text_column or "").strip().lower()
    by_name = "comment" if text_name in COMMENT_TEXT_NAMES else "post" if text_name in POST_TEXT_NAMES else None
    parents_used = any(_has_value(row.get(col)) for row in sample_rows for col in parent_cols)

    def detect(row) -> str:
        if kind_col is not None:
            explicit = _kind_from_value(row.get(kind_col))
            if explicit:
                return explicit
        if parents_used:
            return "comment" if any(_has_value(row.get(col)) for col in parent_cols) else "post"
        return by_name or "unknown"

    return detect

def ingest_reddit(url: str) -> list[dict]:
    json_url = url.split("?")[0].rstrip("/") + ".json"
    headers = {"User-Agent": "VerdictLab/0.1 ( research tool)"}
    with httpx.Client(timeout=15, headers=headers) as client:
        resp = client.get(json_url)
        if resp.status_code == 403 and re.search(r"/r/[^/]+/?$", url.split("?")[0]):
            return _ingest_reddit_rss(client, url)
        resp.raise_for_status()
        data = resp.json()

    records: list[dict] = []

    def add(text: str | None, data_node: dict, kind: str) -> None:
        if text and text.strip():
            record = {"text": text, "kind": kind}

            if data_node.get("subreddit"):
                record["subreddit"] = f"r/{data_node['subreddit']}"
            if data_node.get("created_utc") is not None:
                record["created_time"] = datetime.fromtimestamp(
                    float(data_node["created_utc"])
                ).isoformat()
            if data_node.get("score") is not None:
                record["upvotes"] = data_node["score"]
            records.append(record)

    def walk_comments(children):
        for child in children:
            node = child.get("data", {})
            add(node.get("body"), node, "comment")
            replies = node.get("replies")
            if isinstance(replies, dict):
                walk_comments(replies.get("data", {}).get("children", []))


    if isinstance(data, dict):
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            if child.get("kind") == "t3":
                add(
                    f"{post.get('title', '')}. {post.get('selftext', '')}".strip(),
                    post,
                    "post",
                )
        return records

    if isinstance(data, list) and len(data) >= 2:
        post = data[0]["data"]["children"][0]["data"]
        title, selftext = post.get("title", ""), post.get("selftext", "")
        add(f"{title}. {selftext}".strip(), post, "post")
        walk_comments(data[1]["data"]["children"])

    return records

def _ingest_reddit_rss(client: httpx.Client, url: str) -> list[dict]:
    """Read the official Reddit Atom feed when the JSON endpoint is blocked."""
    feed_url = url.split("?")[0].rstrip("/") + "/.rss"
    for attempt in range(2):
        response = client.get(
            feed_url,
            headers={
                "Accept": "application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
                "User-Agent": "VerdictLab/0.1 (research tool; contact project maintainer)",
            },
        )
        if response.status_code != 429 or attempt == 1:
            break
        retry_after = response.headers.get("retry-after", "")
        try:
            delay = min(max(float(retry_after), 0), 60)
        except ValueError:
            delay = 2
        if delay == 0:
            delay = 2
        time.sleep(delay)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    records: list[dict] = []
    for entry in root.findall("atom:entry", namespace):
        title = entry.findtext("atom:title", default="", namespaces=namespace)
        content = entry.findtext("atom:content", default="", namespaces=namespace)
        text = f"{title}. {html.unescape(re.sub(r'<[^>]+>', ' ', content))}"
        text = re.sub(r"\s+", " ", text).strip(" .")
        if not text:
            continue
        link = entry.find("atom:link", namespace)
        record = {
            "text": text,
            "kind": "post",
            "created_time": entry.findtext("atom:updated", default=None, namespaces=namespace),
        }
        if link is not None and link.get("href"):
            record["source_link"] = link.get("href")
        records.append(record)
    return records

def _youtube_video_post(client: httpx.Client, video_id: str, api_key: str) -> dict | None:
    """The video's own title + description, treated as the 'post' the comments reply to."""
    try:
        resp = client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "snippet", "id": video_id, "key": api_key},
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return None
        snippet = items[0]["snippet"]
        text = f"{snippet.get('title', '')}. {snippet.get('description', '')}".strip()
        return {"text": text, "kind": "post"} if text.strip(". ") else None
    except Exception:
        return None

def ingest_youtube(url: str) -> list[dict]:
    api_key = os.getenv("YOUTUBE_API_KEY")
    video_id = _extract_youtube_id(url)

    if not api_key:
        raise ValueError("YOUTUBE_API_KEY is required to analyze YouTube comments.")
    if not video_id:
        raise ValueError("Could not find a YouTube video ID in the supplied URL.")

    records: list[dict] = []
    page_token = None
    with httpx.Client(timeout=15) as client:
        video_post = _youtube_video_post(client, video_id, api_key)
        if video_post:
            records.append(video_post)
        for _ in range(5):
            params = {
                "part": "snippet",
                "videoId": video_id,
                "maxResults": 100,
                "key": api_key,
            }
            if page_token:
                params["pageToken"] = page_token
            resp = client.get(
                "https://www.googleapis.com/youtube/v3/commentThreads", params=params
            )
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("items", []):
                text = item["snippet"]["topLevelComment"]["snippet"]["textDisplay"]
                records.append({"text": text, "kind": "comment"})
            page_token = data.get("nextPageToken")
            if not page_token:
                break
    return records

def ingest_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig", errors="ignore")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    fieldnames = reader.fieldnames or []
    rows = list(reader)
    text_col = _choose_text_column(
        [f for f in fieldnames if f],
        {f: [r.get(f) for r in rows[:500]] for f in fieldnames if f},
    )
    if text_col is None and fieldnames:
        def _avg_len(col):
            vals = [len(str(r.get(col) or "")) for r in rows[:500]]
            return sum(vals) / len(vals) if vals else 0
        text_col = max(fieldnames, key=_avg_len)
    if not text_col:
        return []
    file_columns = {str(name).strip().lower(): name for name in fieldnames if name}
    detect_kind = _make_kind_detector(file_columns, rows[:2000], text_col)
    records = []
    for row in rows:
        text = row.get(text_col)
        if not text or not text.strip():
            continue
        record = {"text": text.strip(), "kind": detect_kind(row)}
        columns = {str(key).strip().lower(): key for key in row}
        for canonical_name, aliases in FIELD_ALIASES.items():
            source = next((columns[alias] for alias in aliases if alias in columns), None)
            if source and row.get(source) not in (None, ""):
                record[canonical_name] = row[source]
        if "created_time" in record:
            time_col = _time_source(columns, next((columns[a] for a in FIELD_ALIASES["created_time"] if a in columns), None))
            if time_col is not None and row.get(time_col) not in (None, ""):
                record["created_time"] = _merge_date_time(record["created_time"], row[time_col])
        records.append(record)
    return records

def _frame_records(frame: pd.DataFrame) -> list[dict]:
    columns = {str(column).strip().lower(): column for column in frame.columns}
    sample = frame.head(500)
    text_column = _choose_text_column(list(frame.columns), {c: sample[c].tolist() for c in frame.columns})
    if text_column is None:
        return []
    if text_column is None and len(frame.columns):
        sample = frame.head(500)
        text_column = max(
            frame.columns,
            key=lambda col: sample[col].astype(str).str.len().mean() if len(sample) else 0,
        )
    if text_column is None:
        return []

    detect_kind = _make_kind_detector(columns, [row for _, row in frame.head(2000).iterrows()], text_column)
    records = []
    for _, row in frame.iterrows():
        text = row.get(text_column)
        if pd.isna(text) or not str(text).strip():
            continue
        record = {"text": str(text).strip(), "kind": detect_kind(row)}
        for canonical_name, aliases in FIELD_ALIASES.items():
            source_col = next((columns[alias] for alias in aliases if alias in columns), None)
            if source_col is not None and not pd.isna(row.get(source_col)):
                record[canonical_name] = row.get(source_col)
        if "created_time" in record:
            created_col = next((columns[a] for a in FIELD_ALIASES["created_time"] if a in columns), None)
            time_col = _time_source(columns, created_col)
            if time_col is not None and not pd.isna(row.get(time_col)):
                record["created_time"] = _merge_date_time(record["created_time"], row.get(time_col))
        records.append(record)
    return records

def ingest_file(file_bytes: bytes, filename: str | None) -> list[dict]:
    """Read a supported upload and return text records from its first sheet/column."""
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".csv":
        return ingest_csv(file_bytes)
    if suffix in {".xls", ".xlsx"}:
        engine = "xlrd" if suffix == ".xls" else "openpyxl"
        try:
            frame = pd.read_excel(io.BytesIO(file_bytes), engine=engine)
        except Exception:


            try:
                return _frame_records(pd.read_csv(io.BytesIO(file_bytes)))
            except Exception:
                return ingest_csv(file_bytes)
        if frame.empty:
            return []
        return _frame_records(frame)

    raise ValueError(f"Unsupported file type '{suffix or 'unknown'}'. Upload a .csv, .xls or .xlsx file.")

def _extract_youtube_id(url: str) -> str | None:
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    if "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    return None
