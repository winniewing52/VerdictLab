"""
Database setup.

Why SQLite:
- Zero setup: it's a single file (verdictlab.db) that lives next to the app.
- Plenty fast for one worker process doing background analysis jobs.
- SQLAlchemy is used as the ORM so swapping to Postgres later is a
  one-line change (just replace DATABASE_URL) if you outgrow SQLite -
  e.g. once you run multiple worker processes and need real concurrency.
"""
import os
from datetime import datetime

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verdictlab.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_startup_migrations() -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue

            existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = column.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))


        if inspector.has_table("users"):
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "password_changed_at" in user_columns:
                conn.execute(
                    text(
                        'UPDATE users SET password_changed_at = created_at '
                        'WHERE password_changed_at IS NULL'
                    )
                )
            if "two_factor_enabled" in user_columns:
                conn.execute(
                    text("UPDATE users SET two_factor_enabled = 0 WHERE two_factor_enabled IS NULL")
                )

        if inspector.has_table("sessions"):
            session_columns = {col["name"] for col in inspector.get_columns("sessions")}
            if "last_seen" in session_columns:
                conn.execute(
                    text('UPDATE sessions SET last_seen = created_at WHERE last_seen IS NULL')
                )


        fresh = inspect(conn)
        if fresh.has_table("analyses") and fresh.has_table("users"):
            analysis_columns = {col["name"] for col in fresh.get_columns("analyses")}
            if "user_id" in analysis_columns:
                user_ids = [row[0] for row in conn.execute(text("SELECT id FROM users LIMIT 2"))]
                if len(user_ids) == 1:
                    conn.execute(
                        text("UPDATE analyses SET user_id = :uid WHERE user_id IS NULL"),
                        {"uid": user_ids[0]},
                    )


        if fresh.has_table("analyses"):
            conn.execute(
                text(
                    "UPDATE analyses SET is_demo = 1 "
                    "WHERE id = ("
                    "SELECT id FROM analyses "
                    "WHERE source_url = 'https://www.reddit.com/r/IranWarReport/' "
                    "AND status = 'complete' ORDER BY updated_at DESC LIMIT 1)"
                )
            )


            if engine.dialect.name == "sqlite":
                conn.execute(
                    text(
                        "UPDATE analyses SET report_markdown = replace("
                        "report_markdown, '**Quality score:** ' || CAST(quality_score AS TEXT), "
                        "'**Model quality:** not reported without an independently labelled evaluation set.') "
                        "WHERE report_markdown IS NOT NULL AND quality_score IS NOT NULL"
                    )
                )
                conn.execute(text("UPDATE analyses SET quality_score = NULL"))
                conn.execute(
                    text(
                        "UPDATE analyses SET result_summary = json_set(result_summary, '$.quality_score', NULL) "
                        "WHERE result_summary IS NOT NULL"
                    )
                )
