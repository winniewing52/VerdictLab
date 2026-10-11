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


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def send_verification_email(to_email: str, code: str) -> EmailResult:
    """Send the verification code. NEVER raises.

    If SMTP is missing or fails for any reason (bad key, blocked port,
    unverified sender, timeout...), return delivered=False so the signup
    endpoint can fail closed without exposing the code to the client.
    """
    if not _smtp_configured():
        return EmailResult(delivered=False, reason="SMTP not configured")

    try:
        host = os.environ["SMTP_HOST"]
        port = int(os.getenv("SMTP_PORT", "587"))
        username = os.getenv("SMTP_USERNAME")
        password = os.getenv("SMTP_PASSWORD")
        from_addr = os.getenv("SMTP_FROM", username or "noreply@example.com")
        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

        message = EmailMessage()
        message["Subject"] = "Your verification code"
        message["From"] = from_addr
        message["To"] = to_email
        message.set_content(
            f"Your verification code is: {code}\n\n"
            f"This code expires in 10 minutes. If you didn't request this, you can ignore this email."
        )

        with smtplib.SMTP(host, port, timeout=10) as server:
            if use_tls:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.send_message(message)

        return EmailResult(delivered=True)
    except Exception as exc:
        logger.warning("Verification email to %s failed: %r", to_email, exc)
        print(f"[emailer] Could not send email to {to_email}: {exc!r}")
        return EmailResult(delivered=False, reason=str(exc))
