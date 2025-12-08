"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.audit import AuditEvent, audit_log
from app.core.rate_limiter import limiter
from app.core.security import create_access_token, decode_session, decode_token
from app.core.token_blacklist import token_blacklist
from app.db.repositories.users import UserRepository
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    SessionResponse,
    SessionUser,
    TokenPair,
)
from app.services.auth_service import AuthService

router = APIRouter()


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request, considering proxies.

    R4-S1 SECURITY NOTE: X-Forwarded-For can be spoofed by clients.
    In production, ensure your reverse proxy (nginx/cloudflare) is configured
    to overwrite this header, and only trust it when requests come from
    known proxy IPs. For rate limiting, consider using the direct client IP
    as a fallback.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take first IP (original client), but log both for security auditing
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/token", response_model=TokenPair)
@limiter.limit("5/minute")
async def login_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> TokenPair:
    """Login with OAuth2 form (rate limited: 5/minute)."""
    ip = _get_client_ip(request)
    try:
        result = await auth_service.authenticate(form_data.username, form_data.password)
        audit_log(
            AuditEvent.LOGIN_SUCCESS,
            ip_address=ip,
            details={"method": "oauth2_form", "username": form_data.username[:3] + "***"},
        )
        return result
    except HTTPException:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            ip_address=ip,
            success=False,
            details={"method": "oauth2_form", "username": form_data.username[:3] + "***"},
        )
        raise


@router.post("/login", response_model=TokenPair)
@limiter.limit("5/minute")
async def login_json(
    request: Request,
    payload: LoginRequest,
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> TokenPair:
    """Login with JSON body (rate limited: 5/minute)."""
    ip = _get_client_ip(request)
    try:
        result = await auth_service.authenticate(payload.email, payload.password)
        audit_log(
            AuditEvent.LOGIN_SUCCESS,
            ip_address=ip,
            details={"method": "json", "email": payload.email[:3] + "***"},
        )
        return result
    except HTTPException:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            ip_address=ip,
            success=False,
            details={"method": "json", "email": payload.email[:3] + "***"},
        )
        raise


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    payload: RefreshRequest,
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> TokenPair:
    """Refresh access token (rate limited: 10/minute)."""
    # Check if the refresh token is blacklisted
    if token_blacklist.is_blacklisted(payload.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revocado")
    return await auth_service.refresh(payload.refresh_token)


@router.post("/logout")
@limiter.limit("10/minute")
async def logout(
    request: Request,
    payload: LogoutRequest,
) -> dict[str, str]:
    """Logout and revoke refresh token."""
    ip = _get_client_ip(request)
    try:
        # Decode to get expiration time
        token_data = decode_token(payload.refresh_token)
        exp = token_data.get("exp")
        # Add to blacklist until expiration
        token_blacklist.add(payload.refresh_token, exp)
        audit_log(
            AuditEvent.LOGOUT,
            ip_address=ip,
            details={"token_revoked": True},
        )
    except Exception:
        audit_log(
            AuditEvent.LOGOUT,
            ip_address=ip,
            details={"token_revoked": False},
        )
    return {"message": "Sesión cerrada"}


@router.get("/session", response_model=SessionResponse)
async def session_info(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
) -> SessionResponse:
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión no disponible")

    try:
        payload = decode_session(session_token)
    except HTTPException as exc:  # pragma: no cover - propagates invalid session
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida") from exc

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")

    repo = UserRepository(session)
    user = await repo.get(int(user_id))

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no activo")

    access_token = create_access_token(str(user.id), role=user.role, guardian_id=user.guardian_id)
    return SessionResponse(
        access_token=access_token,
        user=SessionUser(
            id=user.id,
            full_name=user.full_name,
            role=user.role,
            guardian_id=user.guardian_id,
        ),
    )
