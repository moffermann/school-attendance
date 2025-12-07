"""Super Admin authentication endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.security import (
    create_super_admin_refresh_token,
    create_super_admin_token,
    hash_password,
    verify_password,
)
from app.db.repositories.super_admins import SuperAdminRepository

router = APIRouter()


class SuperAdminLoginRequest(BaseModel):
    """Super admin login request."""

    email: EmailStr
    password: str


class SuperAdminTokenResponse(BaseModel):
    """Super admin token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class SuperAdminProfileResponse(BaseModel):
    """Super admin profile response."""

    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


@router.post("/login", response_model=SuperAdminTokenResponse)
async def super_admin_login(
    payload: SuperAdminLoginRequest,
    session: AsyncSession = Depends(deps.get_public_db),
) -> SuperAdminTokenResponse:
    """
    Authenticate a super admin and return JWT tokens.

    This endpoint is separate from tenant user authentication.
    """
    repo = SuperAdminRepository(session)
    admin = await repo.get_by_email(payload.email)

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada",
        )

    if not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Update last login
    admin.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    # Generate tokens
    access_token = create_super_admin_token(admin.id)
    refresh_token = create_super_admin_refresh_token(admin.id)

    return SuperAdminTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.get("/me", response_model=SuperAdminProfileResponse)
async def get_current_super_admin_profile(
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> SuperAdminProfileResponse:
    """Get the current super admin's profile."""
    repo = SuperAdminRepository(session)
    admin_record = await repo.get(admin.id)

    if not admin_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    return SuperAdminProfileResponse(
        id=admin_record.id,
        email=admin_record.email,
        full_name=admin_record.full_name,
        is_active=admin_record.is_active,
        created_at=admin_record.created_at,
        last_login_at=admin_record.last_login_at,
    )


class ChangePasswordRequest(BaseModel):
    """Change password request."""

    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Change the current super admin's password."""
    repo = SuperAdminRepository(session)
    admin_record = await repo.get(admin.id)

    if not admin_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    if not verify_password(payload.current_password, admin_record.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta",
        )

    # Validate new password
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres",
        )

    # Update password
    admin_record.hashed_password = hash_password(payload.new_password)
    await session.commit()

    return {"message": "Contraseña actualizada exitosamente"}
