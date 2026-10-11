import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text
from .database import Base

def gen_id():
    return "A-" + uuid.uuid4().hex[:8]

def gen_user_id():
    return "U-" + uuid.uuid4().hex[:8]

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_user_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    role = Column(String, nullable=True)
    research_focus = Column(String, nullable=True)
    two_factor_enabled = Column(Integer, default=0)
    password_changed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class PendingSignup(Base):
    __tablename__ = "pending_signups"

    email = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    code = Column(String, nullable=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"

    token = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    user_agent = Column(String, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=gen_id)


    user_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    uploaded_filename = Column(String, nullable=True)
    privacy_mode = Column(String, default="redacted", nullable=False)
    consent_public_data = Column(Integer, default=0, nullable=False)
    retention_days = Column(Integer, nullable=True)

    status = Column(String, default="queued")
    stages = Column(JSON, default=dict)
    error = Column(Text, nullable=True)

    records_in = Column(Integer, default=0)
    quality_score = Column(Float, nullable=True)

    result_summary = Column(JSON, nullable=True)
    result_records = Column(JSON, nullable=True)
    report_markdown = Column(Text, nullable=True)
    is_demo = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
