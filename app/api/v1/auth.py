"""Authentication endpoints."""

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.core import deps
from app.schemas.auth import LoginRequest, RefreshRequest, TokenPair
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
