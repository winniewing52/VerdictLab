from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class AnalysisCreate(BaseModel):
    source_type: str
    source_url: Optional[str] = None
    title: Optional[str] = None
    privacy_mode: str = "redacted"
    consent_public_data: bool = False
    retention_days: Optional[int] = 90

class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    source_type: str
    source_url: Optional[str]
    status: str
    stages: dict
    error: Optional[str]
    records_in: int
    quality_score: Optional[float]
    created_at: str
    updated_at: str

class AnalysisResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    result_summary: Optional[dict]
    result_records: Optional[Any]
    report_markdown: Optional[str]

class SignupRequest(BaseModel):
    email: str
    password: str

class ResendCodeRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupResponse(BaseModel):
    email: str
    delivered: bool
    dev_code: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str

class LogoutRequest(BaseModel):
    all_devices: bool = False

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    role: Optional[str] = None
    research_focus: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class TwoFactorRequest(BaseModel):
    password: str
    enabled: bool

class DeleteAccountRequest(BaseModel):
    password: str

class ProfileOut(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    institution: Optional[str] = None
    role: Optional[str] = None
    research_focus: Optional[str] = None
    two_factor_enabled: bool = False
    created_at: str
    password_changed_at: str

class SessionOut(BaseModel):
    id: str
    device: str
    created_at: str
    last_seen: str
    is_current: bool
