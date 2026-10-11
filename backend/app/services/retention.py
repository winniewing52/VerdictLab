from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timedelta

from ..database import SessionLocal
from ..models import Analysis, LoginChallenge, PendingSignup

logger = logging.getLogger("verdictlab.retention")

def purge_expired(now: datetime | None = None) -> dict:
    """Delete analyses past their retention window plus expired one-time codes.

    Never touches the public demo, analyses with no retention limit, or runs still in progress.
    """
    now = now or datetime.utcnow()
    db = SessionLocal()
    try:
        candidates = (
            db.query(Analysis)
            .filter(
                Analysis.retention_days.isnot(None),
                Analysis.is_demo == 0,
                Analysis.status.in_(("complete", "failed")),
            )
            .all()
        )
        expired = [
            a for a in candidates
            if a.created_at and a.created_at + timedelta(days=a.retention_days) <= now
        ]
        for analysis in expired:
            db.delete(analysis)
        signups = db.query(PendingSignup).filter(PendingSignup.expires_at <= now).delete()
        challenges = db.query(LoginChallenge).filter(LoginChallenge.expires_at <= now).delete()
        db.commit()
        result = {"analyses": len(expired), "pending_signups": signups, "login_challenges": challenges}
        if any(result.values()):
            logger.info("Retention sweep removed %s", result)
        return result
    finally:
        db.close()

def start_retention_worker(stop: threading.Event, interval_seconds: int | None = None) -> threading.Thread:
    """Run purge_expired() now and then every `interval_seconds` (default 3600) until `stop` is set."""
    interval = interval_seconds or int(os.getenv("RETENTION_SWEEP_SECONDS", "3600"))

    def loop() -> None:
        while not stop.is_set():
            try:
                purge_expired()
            except Exception:
                logger.exception("Retention sweep failed")
            stop.wait(interval)

    thread = threading.Thread(target=loop, name="retention-sweeper", daemon=True)
    thread.start()
    return thread
