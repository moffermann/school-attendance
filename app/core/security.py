"""Security utilities (JWT, password hashing)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt
from fastapi import HTTPException, status
from itsdangerous import URLSafeSerializer, BadSignature
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")


def create_access_token(subject: str, expires_minutes: int | None = None, **extra: Any) -> str:
    """Create a JWT access token (legacy, for backwards compatibility)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_access_expires_min
    )
    # R17-SESS1 fix: Include issuer claim to prevent cross-application token confusion
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iss": "school-attendance",  # Issuer claim for token validation
        **extra
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_tenant_access_token(
    user_id: int,
    tenant_id: int,
    tenant_slug: str,
    role: str,
    expires_minutes: int | None = None,
    **extra: Any,
) -> str:
    """Create a JWT access token for a tenant user."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_access_expires_min
    )
    to_encode: Dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "iss": "school-attendance",
        "typ": "tenant",
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
        "role": role,
        **extra,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_super_admin_token(
    admin_id: int,
    expires_minutes: int | None = None,
) -> str:
    """Create a JWT access token for a super admin."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_access_expires_min
    )
    to_encode: Dict[str, Any] = {
        "sub": str(admin_id),
        "exp": expire,
        "iss": "school-attendance",
        "typ": "super_admin",
        "role": "SUPER_ADMIN",
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_refresh_token(subject: str, expires_days: int | None = None) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=expires_days or settings.jwt_refresh_expires_days
    )
    # TDD-BUG1 fix: Include issuer claim to prevent cross-application token confusion
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iss": "school-attendance",  # Must match access token issuer
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_tenant_refresh_token(
    user_id: int,
    tenant_id: int,
    expires_days: int | None = None,
) -> str:
    """Create a JWT refresh token for a tenant user."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=expires_days or settings.jwt_refresh_expires_days
    )
    to_encode: Dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "iss": "school-attendance",
        "typ": "tenant_refresh",
        "tenant_id": tenant_id,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_super_admin_refresh_token(
    admin_id: int,
    expires_days: int | None = None,
) -> str:
    """Create a JWT refresh token for a super admin."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=expires_days or settings.jwt_refresh_expires_days
    )
    to_encode: Dict[str, Any] = {
        "sub": str(admin_id),
        "exp": expire,
        "iss": "school-attendance",
        "typ": "super_admin_refresh",
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> Dict[str, Any]:
    try:
        # TDD-R2-BUG1 fix: Validate issuer claim to prevent cross-application token confusion
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=["HS256"],
            issuer="school-attendance",
            options={"require": ["iss", "sub", "exp"]}
        )
    except jwt.PyJWTError as exc:  # pragma: no cover - pass-through error mapping
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception:  # pragma: no cover - fallback when bcrypt backend unavailable
        return pwd_context.hash(password, scheme="pbkdf2_sha256")


def encode_session(data: Dict[str, Any]) -> str:
    return session_serializer.dumps(data)


def decode_session(token: str) -> Dict[str, Any]:
    try:
        return session_serializer.loads(token)
    except BadSignature as exc:  # pragma: no cover - invalid session cookie
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc
session_serializer = URLSafeSerializer(settings.secret_key, salt="session")
