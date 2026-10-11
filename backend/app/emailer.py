from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("verdictlab.emailer")

@dataclass
class EmailResult:
    delivered: bool
    reason: str | None = None

def delivery_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))

def dev_codes_enabled() -> bool:
    return os.getenv("VERDICTLAB_DEV_CODES", "").strip().lower() in ("1", "true", "yes", "on")

def can_deliver_codes() -> bool:
    """A one-time code can reach the user, by email or by the dev-mode on-screen fallback."""
    return delivery_configured() or dev_codes_enabled()

def _send(to_email: str, subject: str, body: str) -> EmailResult:
    if not delivery_configured():
        return EmailResult(delivered=False, reason="SMTP not configured")

    try:
        host = os.environ["SMTP_HOST"]
        port = int(os.getenv("SMTP_PORT", "587"))
        username = os.getenv("SMTP_USERNAME")
        password = os.getenv("SMTP_PASSWORD")
        from_addr = os.getenv("SMTP_FROM", username or "noreply@example.com")
        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = from_addr
        message["To"] = to_email
        message.set_content(body)

        with smtplib.SMTP(host, port, timeout=10) as server:
            if use_tls:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.send_message(message)

        return EmailResult(delivered=True)
    except Exception as exc:
        logger.warning("Email to %s failed: %r", to_email, exc)
        print(f"[emailer] Could not send email to {to_email}: {exc!r}")
        return EmailResult(delivered=False, reason=str(exc))

def send_verification_email(to_email: str, code: str) -> EmailResult:
    return _send(
        to_email,
        "Your verification code",
        f"Your verification code is: {code}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, you can ignore this email.",
    )

def send_login_code_email(to_email: str, code: str) -> EmailResult:
    return _send(
        to_email,
        "Your VerdictLab sign-in code",
        f"Your sign-in code is: {code}\n\n"
        f"It expires in 10 minutes. If you didn't just try to sign in, change your password.",
    )
