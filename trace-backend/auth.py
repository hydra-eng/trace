"""
Authentication module — JWT-based auth for TRACE API.

Provides:
  - create_access_token(data, expires_delta) → str
  - get_current_user(token) → dict (FastAPI dependency)
  - verify_password(plain, hashed) → bool
  - hash_password(password) → str

Hardcoded users for hackathon demo:
  investigator / PrakasamPolice_2026!
  admin / AdminPass123!
"""
import os
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Config ────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("TRACE_JWT_SECRET", "trace-hackathon-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# ── Hardcoded Users (hackathon demo) ──────────────────────────────────────────
USERS_DB = {
    "investigator": {
        "username": "investigator",
        "password_hash": hashlib.sha256("PrakasamPolice_2026!".encode()).hexdigest(),
        "display_name": "Inspector Sharma",
        "badge": "AP-TN-2847",
        "unit": "Prakasham District SP Office",
        "role": "investigator",
    },
    "admin": {
        "username": "admin",
        "password_hash": hashlib.sha256("AdminPass123!".encode()).hexdigest(),
        "display_name": "System Administrator",
        "badge": "AP-ADMIN-001",
        "unit": "TRACE System Admin",
        "role": "admin",
    },
}

# ── Security Scheme ───────────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)


# ── Password Helpers ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_password(plain), hashed)


# ── Token Helpers ─────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRY_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ── FastAPI Dependency ────────────────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Extracts and validates JWT from Authorization header.
    Returns the user dict if valid, raises 401 if not.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    username = payload.get("sub")
    if not username or username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return USERS_DB[username]


# ── Optional Auth (for endpoints that work with or without token) ─────────────
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """Returns user if token provided and valid, None otherwise."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
