from __future__ import annotations

import hashlib
import hmac
import os
import secrets

PBKDF2_ITERATIONS = 260_000
SALT_BYTES = 16

def hash_password(password: str) -> str:
    salt = os.urandom(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_str, salt_hex, hash_hex = stored_hash.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    iterations = int(iterations_str)
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(hash_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)

def generate_verification_code(length: int = 6) -> str:
    """Cryptographically-random numeric code, e.g. '048213'."""
    return "".join(secrets.choice("0123456789") for _ in range(length))

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)
