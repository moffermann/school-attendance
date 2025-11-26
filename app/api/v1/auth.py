"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
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

from app.core.rate_limiter import limiter

router = APIRouter()


@router.post("/token", response_model=TokenPair)
@limiter.limit("5/minute")
async def login_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> TokenPair:
    """Login with OAuth2 form (rate limited: 5/minute)."""
    return await auth_service.authenticate(form_data.username, form_data.password)


@router.post("/login", response_model=TokenPair)
@limiter.limit("5/minute")
async def login_json(
    request: Request,
    payload: LoginRequest,
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> TokenPair:
    """Login with JSON body (rate limited: 5/minute)."""
    return await auth_service.authenticate(payload.email, payload.password)


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
    try:
        # Decode to get expiration time
        token_data = decode_token(payload.refresh_token)
        exp = token_data.get("exp")
        # Add to blacklist until expiration
        token_blacklist.add(payload.refresh_token, exp)
    except Exception:
        pass  # Token already invalid, nothing to revoke
    return {"message": "Sesión cerrada"}


@router.get("/session", response_model=SessionResponse)
async def session_info(
    request: Request,
    session: AsyncSession = Depends(deps.get_db),
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
