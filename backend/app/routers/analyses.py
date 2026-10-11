from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Analysis, User
from .auth import get_optional_user
from ..services.pipeline import run_pipeline
from ..services import sentic

router = APIRouter(prefix="/analyses", tags=["analyses"])
DEMO_SOURCE_URL = "https://www.reddit.com/r/IranWarReport/"

DEFAULT_STAGES = {
    "collecting_content": {"label": "Collecting content", "progress": 0, "status": "queued"},
    "cleaning_dedup": {"label": "Cleaning & dedup", "progress": 0, "status": "queued"},
    "model_comparison": {"label": "Model comparison", "progress": 0, "status": "queued"},
}

def _serialize(a: Analysis) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "source_type": a.source_type,
        "source_url": a.source_url,
        "status": a.status,
        "stages": a.stages or DEFAULT_STAGES,
        "error": a.error,
        "records_in": a.records_in,
        "quality_score": a.quality_score,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
        "is_demo": bool(a.is_demo),
    }

def _load_owned(db: Session, analysis_id: str, user: Optional[User]) -> Analysis:
    """Fetch an analysis, hiding it (404) from anyone but its owner."""
    a = db.get(Analysis, analysis_id)
    if not a or (not a.is_demo and (user is None or a.user_id != user.id)):
        raise HTTPException(404, "Analysis not found")
    if a.retention_days and a.created_at + timedelta(days=a.retention_days) <= datetime.utcnow():
        db.delete(a)
        db.commit()
        raise HTTPException(404, "This analysis expired under its retention policy.")
    return a


@router.get("/demo/sample")
def get_demo_sample(db: Session = Depends(get_db)):
    """Return the cached analysis sourced from the public Reddit demo community."""
    analysis = (
        db.query(Analysis)
        .filter(
            Analysis.is_demo == 1,
            Analysis.source_url == DEMO_SOURCE_URL,
            Analysis.status == "complete",
        )
        .order_by(Analysis.updated_at.desc())
        .first()
    )
    if not analysis:
        raise HTTPException(503, "The sample analysis is not available yet.")
    return _serialize(analysis)

@router.post("")
def create_analysis(
    background_tasks: BackgroundTasks,
    source_type: str = Form(...),
    source_url: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    privacy_mode: str = Form("redacted"),
    consent_public_data: bool = Form(False),
    retention_days: Optional[int] = Form(90),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    if user is None:
        raise HTTPException(401, "Sign in before creating an analysis.")
    if source_type not in ("reddit", "youtube", "csv"):
        raise HTTPException(400, "source_type must be reddit, youtube, or csv")
    if source_type == "csv" and not file:
        raise HTTPException(400, "csv source_type requires a file upload")
    if source_type == "csv" and file and not (file.filename or "").lower().endswith((".csv", ".xls", ".xlsx")):
        raise HTTPException(400, "file must be a CSV, XLS, or XLSX upload")
    if source_type in ("reddit", "youtube") and not source_url:
        raise HTTPException(400, "source_url is required for reddit/youtube")
    if privacy_mode not in ("redacted", "raw"):
        raise HTTPException(400, "privacy_mode must be redacted or raw")
    if source_type in ("reddit", "youtube") and not consent_public_data:
        raise HTTPException(400, "Confirm that you have a lawful basis to analyse this public content.")
    if retention_days is not None and retention_days not in (30, 90, 365):
        raise HTTPException(400, "retention_days must be 30, 90, 365, or omitted.")

    analysis = Analysis(
        user_id=user.id,
        title=title or f"{source_type.capitalize()} thread analysis",
        source_type=source_type,
        source_url=source_url,
        uploaded_filename=file.filename if file else None,
        privacy_mode=privacy_mode,
        consent_public_data=int(consent_public_data),
        retention_days=retention_days,
        stages=DEFAULT_STAGES,
        status="queued",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    file_bytes = file.file.read() if file else None
    background_tasks.add_task(run_pipeline, analysis.id, file_bytes, file.filename if file else None)

    return _serialize(analysis)

@router.get("")
def list_analyses(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):

    if user is None:
        return []
    rows = (
        db.query(Analysis)
        .filter(Analysis.user_id == user.id, Analysis.is_demo == 0)
        .order_by(Analysis.created_at.desc())
        .limit(50)
        .all()
    )
    expired = [
        row for row in rows
        if row.retention_days and row.created_at + timedelta(days=row.retention_days) <= datetime.utcnow()
    ]
    for row in expired:
        db.delete(row)
    if expired:
        db.commit()
        rows = [row for row in rows if row not in expired]
    return [_serialize(a) for a in rows]

@router.get("/{analysis_id}")
def get_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    a = _load_owned(db, analysis_id, user)
    return _serialize(a)

@router.get("/{analysis_id}/results")
def get_results(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    a = _load_owned(db, analysis_id, user)
    records = []
    for record in a.result_records or []:
        if not record.get("emotion"):
            dimension = sentic.dominant_dimension(record.get("sentics"))
            record = {
                **record,
                "emotion": dimension or "unknown",
                "emotion_source": "senticnet" if dimension else "not_available",
            }
        records.append(record)
    summary = dict(a.result_summary or {})
    return {
        "id": a.id,
        "status": a.status,
        "result_summary": summary if a.result_summary is not None else None,
        "result_records": records if a.result_records is not None else None,
    }

@router.get("/{analysis_id}/report")
def get_report(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    a = _load_owned(db, analysis_id, user)
    if a.status != "complete":
        raise HTTPException(409, f"Analysis is not complete yet (status: {a.status})")
    return {"id": a.id, "report_markdown": a.report_markdown}

@router.delete("/{analysis_id}")
def delete_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    a = _load_owned(db, analysis_id, user)
    if a.is_demo:
        raise HTTPException(403, "The public sample analysis cannot be deleted.")
    db.delete(a)
    db.commit()
    return {"ok": True}
