from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..emailer import send_verification_email
from ..models import Analysis, PendingSignup, Session as SessionModel, User
from ..schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    LogoutRequest,
    ProfileOut,
    ResendCodeRequest,
    SessionOut,
    SignupRequest,
    SignupResponse,
    TwoFactorRequest,
    UpdateProfileRequest,
    VerifyCodeRequest,
)
from ..security import (
    generate_session_token,
    generate_verification_code,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

def _normalize_email(email: str) -> str:
    return email.strip().lower()

def _device_label(ua: Optional[str]) -> str:
    if not ua:
        return "Unknown device"
    u = ua.lower()
    if "iphone" in u or ("ios" in u and "safari" in u):
        return "iPhone · Safari"
    if "android" in u:
        return "Android · Chrome" if "chrome" in u else "Android device"
    if "macintosh" in u or "mac os" in u:
        if "chrome" in u:
            return "Mac · Chrome"
        if "safari" in u:
            return "Mac · Safari"
        return "Mac · Browser"
    if "windows" in u:
        if "edg" in u:
            return "Windows · Edge"
        if "chrome" in u:
            return "Windows · Chrome"
        return "Windows · Browser"
    return "Browser"

def _create_session(db: DBSession, user: User, request: Optional[Request] = None) -> str:
    token = generate_session_token()
    ua = request.headers.get("user-agent") if request else None
    db.add(SessionModel(token=token, user_id=user.id, user_agent=ua))
    db.commit()
    return token

def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db),
) -> tuple[User, SessionModel, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not signed in.")
    token = authorization.split(" ", 1)[1].strip()

    session = db.get(SessionModel, token)
    if not session:
        raise HTTPException(401, "Session is invalid or has expired.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Session is invalid or has expired.")

    session.last_seen = datetime.utcnow()
    db.commit()
    return user, session, token

def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user, but returns None instead of raising 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    session = db.get(SessionModel, token)
    if not session:
        return None
    return db.get(User, session.user_id)

def _profile_out(user: User) -> ProfileOut:
    return ProfileOut(
        user_id=user.id,
        email=user.email,
        name=user.name,
        institution=user.institution,
        role=user.role,
        research_focus=user.research_focus,
        two_factor_enabled=bool(user.two_factor_enabled),
        created_at=user.created_at.isoformat(),
        password_changed_at=(user.password_changed_at or user.created_at).isoformat(),
    )

@router.post("/signup", response_model=SignupResponse)
def signup(payload: SignupRequest, db: DBSession = Depends(get_db)):
    email = _normalize_email(payload.email)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email has already been created. Please sign in instead.")

    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES)

    existing = db.get(PendingSignup, email)
    if existing:
        existing.password_hash = hash_password(payload.password)
        existing.code = code
        existing.attempts = 0
        existing.expires_at = expires_at
    else:
        db.add(
            PendingSignup(
                email=email,
                password_hash=hash_password(payload.password),
                code=code,
                attempts=0,
                expires_at=expires_at,
            )
        )
    db.commit()

    result = send_verification_email(email, code)
    if not result.delivered:
        raise HTTPException(503, "Verification email could not be sent. Please try again later.")
    return SignupResponse(email=email, delivered=True)

@router.post("/resend-code", response_model=SignupResponse)
def resend_code(payload: ResendCodeRequest, db: DBSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    pending = db.get(PendingSignup, email)
    if not pending:
        raise HTTPException(404, "No signup is pending for this email. Please start again.")

    code = generate_verification_code()
    pending.code = code
    pending.attempts = 0
    pending.expires_at = datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES)
    db.commit()

    result = send_verification_email(email, code)
    if not result.delivered:
        raise HTTPException(503, "Verification email could not be sent. Please try again later.")
    return SignupResponse(email=email, delivered=True)

@router.post("/verify", response_model=AuthResponse)
def verify_code(payload: VerifyCodeRequest, request: Request, db: DBSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    pending = db.get(PendingSignup, email)
    if not pending:
        raise HTTPException(400, "No verification is pending for this email. Please start again.")

    if datetime.utcnow() > pending.expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(400, "That code has expired. Please request a new one.")

    if pending.attempts >= MAX_ATTEMPTS:
        db.delete(pending)
        db.commit()
        raise HTTPException(429, "Too many incorrect attempts. Please request a new code.")

    if payload.code.strip() != pending.code:
        pending.attempts += 1
        db.commit()
        remaining = MAX_ATTEMPTS - pending.attempts
        if remaining <= 0:
            db.delete(pending)
            db.commit()
            raise HTTPException(429, "Too many incorrect attempts. Please request a new code.")
        raise HTTPException(400, f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} left.")

    if db.query(User).filter(User.email == email).first():
        db.delete(pending)
        db.commit()
        raise HTTPException(409, "An account with this email has already been created. Please sign in instead.")

    user = User(email=email, password_hash=pending.password_hash)
    db.add(user)
    db.delete(pending)
    db.commit()
    db.refresh(user)

    token = _create_session(db, user, request)
    return AuthResponse(token=token, user_id=user.id, email=user.email)

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: DBSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "No account found for this email. Please create an account first.")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect password. Please try again.")

    token = _create_session(db, user, request)
    return AuthResponse(token=token, user_id=user.id, email=user.email)

@router.get("/me", response_model=AuthResponse)
def me(authorization: Optional[str] = Header(default=None), db: DBSession = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not signed in.")
    token = authorization.split(" ", 1)[1].strip()

    session = db.get(SessionModel, token)
    if not session:
        raise HTTPException(401, "Session is invalid or has expired.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Session is invalid or has expired.")

    return AuthResponse(token=token, user_id=user.id, email=user.email)

@router.post("/logout")
def logout(
    payload: LogoutRequest = LogoutRequest(),
    authorization: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        return {"ok": True}

    token = authorization.split(" ", 1)[1].strip()
    session = db.get(SessionModel, token)
    if not session:
        return {"ok": True}

    if payload.all_devices:
        db.query(SessionModel).filter(SessionModel.user_id == session.user_id).delete()
    else:
        db.delete(session)
    db.commit()
    return {"ok": True}

@router.get("/profile", response_model=ProfileOut)
def get_profile(current: tuple = Depends(get_current_user)):
    user, _, _ = current
    return _profile_out(user)

@router.patch("/profile", response_model=ProfileOut)
def update_profile(
    payload: UpdateProfileRequest,
    current: tuple = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user, _, _ = current
    if payload.name is not None:
        cleaned = payload.name.strip()[:80]
        user.name = cleaned or None
    if payload.institution is not None:
        user.institution = payload.institution.strip()[:120] or None
    if payload.role is not None:
        user.role = payload.role.strip()[:60] or None
    if payload.research_focus is not None:
        user.research_focus = payload.research_focus.strip()[:180] or None
    db.commit()
    db.refresh(user)
    return _profile_out(user)

@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current: tuple = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user, _, _ = current
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(401, "Current password is incorrect.")
    if len(payload.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters.")
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/two-factor", response_model=ProfileOut)
def update_two_factor(
    payload: TwoFactorRequest,
    current: tuple = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user, _, _ = current
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Password is incorrect.")
    user.two_factor_enabled = 1 if payload.enabled else 0
    db.commit()
    db.refresh(user)
    return _profile_out(user)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(current: tuple = Depends(get_current_user), db: DBSession = Depends(get_db)):
    user, _, token = current
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user.id)
        .order_by(SessionModel.last_seen.desc())
        .all()
    )
    return [
        SessionOut(
            id=s.token,
            device=_device_label(s.user_agent),
            created_at=s.created_at.isoformat(),
            last_seen=(s.last_seen or s.created_at).isoformat(),
            is_current=s.token == token,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: str,
    current: tuple = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user, _, current_token = current
    if session_id == current_token:
        raise HTTPException(400, "Use logout to end your current session.")
    session = db.get(SessionModel, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found.")
    db.delete(session)
    db.commit()
    return {"ok": True}


@router.post("/sessions/revoke-others")
def revoke_other_sessions(current: tuple = Depends(get_current_user), db: DBSession = Depends(get_db)):
    user, _, token = current
    count = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user.id, SessionModel.token != token)
        .delete()
    )
    db.commit()
    return {"ok": True, "revoked": count}


@router.delete("/account")
def delete_account(
    payload: DeleteAccountRequest,
    current: tuple = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user, _, _ = current
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect password.")
    db.query(SessionModel).filter(SessionModel.user_id == user.id).delete()
    db.query(Analysis).filter(Analysis.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    return {"ok": True}
