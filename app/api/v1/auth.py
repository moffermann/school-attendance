"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.security import create_access_token, decode_session
from app.db.repositories.users import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    SessionResponse,
    SessionUser,
    TokenPair,
)
from app.services.auth_service import AuthService


router = APIRouter()


@router.post("/token", response_model=TokenPair)
async def login_token(
    form_data: OAuth2PasswordRequestForm = Depends(), auth_service: AuthService = Depends(deps.get_auth_service)
) -> TokenPair:
    return await auth_service.authenticate(form_data.username, form_data.password)


@router.post("/login", response_model=TokenPair)
async def login_json(
    payload: LoginRequest, auth_service: AuthService = Depends(deps.get_auth_service)
) -> TokenPair:
    return await auth_service.authenticate(payload.email, payload.password)


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(
    payload: RefreshRequest, auth_service: AuthService = Depends(deps.get_auth_service)
) -> TokenPair:
    return await auth_service.refresh(payload.refresh_token)


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
