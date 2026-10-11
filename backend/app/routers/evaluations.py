from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..models import User
from .auth import get_optional_user
from ..services.evaluation import evaluate_csv

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


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
