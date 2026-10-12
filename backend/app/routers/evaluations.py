from typing import Optional

import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..models import User
from .auth import get_optional_user
from ..services.evaluation import evaluate_csv

router = APIRouter(prefix="/evaluations", tags=["evaluations"])
BENCHMARK_PATH = Path(__file__).resolve().parents[2] / "benchmarks" / "tweeteval_sentiment_test.json"


@router.get("/benchmark")
def get_benchmark():
    """Return the committed, reproducible benchmark used by the demo."""
    if not BENCHMARK_PATH.exists():
        raise HTTPException(503, "The reproducible benchmark has not been generated yet.")
    try:
        return json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "The reproducible benchmark could not be loaded.") from exc


@router.post("/sentiment")
async def evaluate_sentiment(
    file: UploadFile = File(...),
    dataset_name: str = Form(...),
    text_column: Optional[str] = Form(None),
    label_column: Optional[str] = Form(None),
    citation: Optional[str] = Form(None),
    user: Optional[User] = Depends(get_optional_user),
):
    if user is None:
        raise HTTPException(401, "Sign in before running an evaluation.")
    if not file.filename or not file.filename.lower().endswith((".csv", ".xls", ".xlsx")):
        raise HTTPException(400, "file must be a CSV, XLS, or XLSX labelled dataset")
    try:
        return evaluate_csv(await file.read(), file.filename, text_column, label_column, dataset_name, citation)
    except (ValueError, KeyError) as exc:
        raise HTTPException(400, str(exc)) from exc
