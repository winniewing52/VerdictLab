import unittest
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Analysis
from app.services.retention import purge_expired

def _make(db, id_, days_old, retention, status="complete", demo=0):
    db.add(Analysis(
        id=id_, title=id_, source_type="reddit", status=status, retention_days=retention,
        is_demo=demo, created_at=datetime.utcnow() - timedelta(days=days_old),
    ))

class RetentionTest(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        db.query(Analysis).delete()
        db.commit()
        db.close()

    def test_only_expired_unprotected_analyses_are_deleted(self):
        db = SessionLocal()
        _make(db, "old-30", 31, 30)                    # expired -> deleted
        _make(db, "young-30", 5, 30)                   # still valid
        _make(db, "old-forever", 900, None)            # no limit
        _make(db, "old-demo", 900, 30, demo=1)         # demo is never purged
        _make(db, "old-running", 900, 30, status="running")  # in progress is left alone
        db.commit()
        db.close()

        result = purge_expired()
        self.assertEqual(result["analyses"], 1)

        db = SessionLocal()
        remaining = {a.id for a in db.query(Analysis).all()}
        db.close()
        self.assertEqual(remaining, {"young-30", "old-forever", "old-demo", "old-running"})

if __name__ == "__main__":
    unittest.main()
