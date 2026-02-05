"""Authorized pickup endpoints for managing adults who can withdraw students."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status

logger = logging.getLogger(__name__)
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.deps import TenantAuthUser
from app.db.repositories.authorized_pickups import AuthorizedPickupRepository

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


# ==================== Schemas ====================


class AuthorizedPickupCreate(BaseModel):
    """Request to create an authorized pickup."""

    full_name: str = Field(..., min_length=2, max_length=255)
    relationship_type: str = Field(..., min_length=2, max_length=100)  # Padre, Madre, Abuelo, etc.
    national_id: str | None = Field(None, max_length=20)  # RUT/DNI
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    student_ids: list[int] = Field(default_factory=list)


class AuthorizedPickupUpdate(BaseModel):
    """Request to update an authorized pickup."""

    full_name: str | None = Field(None, min_length=2, max_length=255)
    relationship_type: str | None = Field(None, min_length=2, max_length=100)
    national_id: str | None = Field(None, max_length=20)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    is_active: bool | None = None


class AuthorizedPickupResponse(BaseModel):
    """Response for an authorized pickup."""

    id: int
    full_name: str
    relationship_type: str
    national_id: str | None
    phone: str | None
    email: str | None
    photo_url: str | None
    is_active: bool
    student_ids: list[int]

    class Config:
        from_attributes = True


class AuthorizedPickupListItem(BaseModel):
    """List item for authorized pickup."""

    id: int
    full_name: str
    relationship_type: str
    national_id: str | None
    is_active: bool
    student_count: int


class PaginatedAuthorizedPickups(BaseModel):
    """Paginated list of authorized pickups."""

    items: list[AuthorizedPickupListItem]
    total: int
    limit: int
    offset: int
    has_more: bool


class QRCodeResponse(BaseModel):
    """Response containing QR code token (shown only once)."""

    qr_token: str
    message: str = "Este token solo se muestra una vez. Genere un nuevo QR si se pierde."


# ==================== Endpoints ====================


@router.get("/search", response_model=list[AuthorizedPickupListItem])
@limiter.limit("60/minute")
async def search_authorized_pickups(
    request: Request,
    q: str = Query(..., min_length=2, description="Search term (name or national ID)"),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[AuthorizedPickupListItem]:
    """Search authorized pickups by name or national ID."""
    if user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para buscar personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickups = await repo.search(q, limit=limit)

    return [
        AuthorizedPickupListItem(
            id=p.id,
            full_name=p.full_name,
            relationship_type=p.relationship_type,
            national_id=p.national_id,
            is_active=p.is_active,
            student_count=len(p.students) if p.students else 0,
        )
        for p in pickups
    ]


@router.get("", response_model=PaginatedAuthorizedPickups)
@limiter.limit("30/minute")
async def list_authorized_pickups(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, min_length=2),
    include_inactive: bool = Query(False),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedAuthorizedPickups:
    """List all authorized pickups with pagination."""
    if user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para listar personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickups, total = await repo.list_paginated(
        skip=offset,
        limit=limit,
        search=search,
        include_inactive=include_inactive,
    )

    items = [
        AuthorizedPickupListItem(
            id=p.id,
            full_name=p.full_name,
            relationship_type=p.relationship_type,
            national_id=p.national_id,
            is_active=p.is_active,
            student_count=len(p.students) if p.students else 0,
        )
        for p in pickups
    ]

    return PaginatedAuthorizedPickups(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@router.post("", response_model=AuthorizedPickupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_authorized_pickup(
    request: Request,
    payload: AuthorizedPickupCreate,
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AuthorizedPickupResponse:
    """Create a new authorized pickup."""
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)

    # Check for duplicate national_id
    if payload.national_id:
        existing = await repo.get_by_national_id(payload.national_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una persona autorizada con RUT {payload.national_id}",
            )

    pickup = await repo.create(
        full_name=payload.full_name,
        relationship_type=payload.relationship_type,
        national_id=payload.national_id,
        phone=payload.phone,
        email=payload.email,
        created_by_user_id=user.id,
    )

    # Associate students if provided
    if payload.student_ids:
        await repo.set_students(pickup.id, payload.student_ids)

    await session.commit()

    # Refresh to get updated relationships
    pickup = await repo.get(pickup.id)

    return AuthorizedPickupResponse(
        id=pickup.id,
        full_name=pickup.full_name,
        relationship_type=pickup.relationship_type,
        national_id=pickup.national_id,
        phone=pickup.phone,
        email=pickup.email,
        photo_url=pickup.photo_url,
        is_active=pickup.is_active,
        student_ids=[s.id for s in pickup.students] if pickup.students else [],
    )


@router.get("/{pickup_id}", response_model=AuthorizedPickupResponse)
async def get_authorized_pickup(
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AuthorizedPickupResponse:
    """Get authorized pickup by ID."""
    if user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    print(f"[DEBUG GET] pickup_id={pickup_id}")
    print(f"[DEBUG GET] pickup.national_id={pickup.national_id}")
    print(f"[DEBUG GET] pickup.relationship_type={pickup.relationship_type}")

    return AuthorizedPickupResponse(
        id=pickup.id,
        full_name=pickup.full_name,
        relationship_type=pickup.relationship_type,
        national_id=pickup.national_id,
        phone=pickup.phone,
        email=pickup.email,
        photo_url=pickup.photo_url,
        is_active=pickup.is_active,
        student_ids=[s.id for s in pickup.students] if pickup.students else [],
    )


@router.patch("/{pickup_id}", response_model=AuthorizedPickupResponse)
@limiter.limit("20/minute")
async def update_authorized_pickup(
    request: Request,
    payload: AuthorizedPickupUpdate,
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AuthorizedPickupResponse:
    """Update an authorized pickup."""
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    # Build update kwargs
    update_data: dict[str, Any] = {}
    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name
    if payload.relationship_type is not None:
        update_data["relationship_type"] = payload.relationship_type
    if payload.national_id is not None:
        update_data["national_id"] = payload.national_id
    if payload.phone is not None:
        update_data["phone"] = payload.phone
    if payload.email is not None:
        update_data["email"] = payload.email
    if payload.is_active is not None:
        update_data["is_active"] = payload.is_active

    if update_data:
        await repo.update(pickup_id, **update_data)

    await session.commit()

    # Refresh
    pickup = await repo.get(pickup_id)

    return AuthorizedPickupResponse(
        id=pickup.id,
        full_name=pickup.full_name,
        relationship_type=pickup.relationship_type,
        national_id=pickup.national_id,
        phone=pickup.phone,
        email=pickup.email,
        photo_url=pickup.photo_url,
        is_active=pickup.is_active,
        student_ids=[s.id for s in pickup.students] if pickup.students else [],
    )


@router.delete("/{pickup_id}")
@limiter.limit("10/minute")
async def deactivate_authorized_pickup(
    request: Request,
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> dict[str, str]:
    """Deactivate an authorized pickup (soft delete)."""
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para desactivar personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    if not pickup.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La persona ya está desactivada",
        )

    await repo.deactivate(pickup_id)
    await session.commit()

    return {"message": "Persona autorizada desactivada exitosamente"}


@router.post("/{pickup_id}/activate")
@limiter.limit("10/minute")
async def activate_authorized_pickup(
    request: Request,
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> dict[str, str]:
    """Reactivate a deactivated authorized pickup."""
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para activar personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    if pickup.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La persona ya está activa",
        )

    await repo.activate(pickup_id)
    await session.commit()

    return {"message": "Persona autorizada activada exitosamente"}


@router.post("/{pickup_id}/regenerate-qr", response_model=QRCodeResponse)
@limiter.limit("5/minute")
async def regenerate_qr_code(
    request: Request,
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> QRCodeResponse:
    """Regenerate QR code for an authorized pickup.

    The returned token should be encoded in a QR image.
    This token is only shown once - if lost, regenerate.
    """
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para regenerar códigos QR",
        )

    repo = AuthorizedPickupRepository(session)
    result = await repo.regenerate_qr(pickup_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    pickup, qr_token = result
    await session.commit()

    return QRCodeResponse(qr_token=qr_token)


@router.put("/{pickup_id}/students")
@limiter.limit("20/minute")
async def set_authorized_students(
    request: Request,
    student_ids: list[int],
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> dict[str, str]:
    """Set the list of students this person can withdraw."""
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para modificar autorizaciones",
        )

    repo = AuthorizedPickupRepository(session)
    success = await repo.set_students(pickup_id, student_ids)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    await session.commit()

    return {"message": f"Autorizado para {len(student_ids)} estudiante(s)"}


# ==================== Student-scoped Endpoints ====================
# These are mounted under /students/{student_id}/authorized-pickups


# Create a separate router for student-scoped endpoints
student_pickups_router = APIRouter()


@student_pickups_router.get("", response_model=list[AuthorizedPickupResponse])
async def get_student_authorized_pickups(
    student_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[AuthorizedPickupResponse]:
    """Get all authorized pickups for a specific student."""
    if user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickups = await repo.list_by_student(student_id)

    return [
        AuthorizedPickupResponse(
            id=p.id,
            full_name=p.full_name,
            relationship_type=p.relationship_type,
            national_id=p.national_id,
            phone=p.phone,
            email=p.email,
            photo_url=p.photo_url,
            is_active=p.is_active,
            student_ids=[s.id for s in p.students] if p.students else [],
        )
        for p in pickups
    ]


@student_pickups_router.post("", response_model=AuthorizedPickupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def add_authorized_pickup_to_student(
    request: Request,
    payload: AuthorizedPickupCreate,
    student_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AuthorizedPickupResponse:
    """Create a new authorized pickup and associate it with a student.

    If a pickup with the same national_id already exists, associates the existing
    pickup with this student instead of creating a duplicate.
    """
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear personas autorizadas",
        )

    # DEBUG: Log received payload
    print(f"[DEBUG] add_authorized_pickup_to_student called")
    print(f"[DEBUG] student_id={student_id}")
    print(f"[DEBUG] payload.full_name={payload.full_name}")
    print(f"[DEBUG] payload.national_id={payload.national_id}")
    print(f"[DEBUG] payload.relationship_type={payload.relationship_type}")
    print(f"[DEBUG] payload.phone={payload.phone}")
    print(f"[DEBUG] payload.email={payload.email}")
    print(f"[DEBUG] payload.student_ids={payload.student_ids}")

    repo = AuthorizedPickupRepository(session)

    # Check if pickup with this national_id already exists
    existing = None
    if payload.national_id:
        existing = await repo.get_by_national_id(payload.national_id)
        print(f"[DEBUG] existing pickup found: {existing}")

    if existing:
        # Associate existing pickup with this student
        pickup = existing
        current_student_ids = [s.id for s in pickup.students] if pickup.students else []
        print(f"[DEBUG] Existing pickup, current_student_ids={current_student_ids}")
        if student_id not in current_student_ids:
            await repo.set_students(pickup.id, current_student_ids + [student_id])
        print(f"[DEBUG] Associated existing pickup {pickup.id} with student {student_id}")
    else:
        # Create new pickup
        print(f"[DEBUG] Creating NEW pickup...")
        pickup = await repo.create(
            full_name=payload.full_name,
            relationship_type=payload.relationship_type,
            national_id=payload.national_id,
            phone=payload.phone,
            email=payload.email,
            created_by_user_id=user.id,
        )
        print(f"[DEBUG] Created pickup: id={pickup.id}, national_id={pickup.national_id}, relationship_type={pickup.relationship_type}")
        # Associate with the student
        print(f"[DEBUG] Calling set_students({pickup.id}, [{student_id}])...")
        set_result = await repo.set_students(pickup.id, [student_id])
        print(f"[DEBUG] set_students result: {set_result}")

    print(f"[DEBUG] Committing session...")
    await session.commit()

    # Refresh to get updated relationships
    print(f"[DEBUG] Fetching pickup after commit...")
    pickup = await repo.get(pickup.id)
    print(f"[DEBUG] After refresh: pickup.national_id={pickup.national_id}")
    print(f"[DEBUG] After refresh: pickup.students={[s.id for s in pickup.students] if pickup.students else []}")

    return AuthorizedPickupResponse(
        id=pickup.id,
        full_name=pickup.full_name,
        relationship_type=pickup.relationship_type,
        national_id=pickup.national_id,
        phone=pickup.phone,
        email=pickup.email,
        photo_url=pickup.photo_url,
        is_active=pickup.is_active,
        student_ids=[s.id for s in pickup.students] if pickup.students else [],
    )


@student_pickups_router.delete("/{pickup_id}")
@limiter.limit("10/minute")
async def remove_authorized_pickup_from_student(
    request: Request,
    student_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> dict[str, str]:
    """Remove an authorized pickup from a specific student.

    This doesn't delete the pickup, only removes the association with this student.
    """
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para remover personas autorizadas",
        )

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona autorizada no encontrada",
        )

    current_student_ids = [s.id for s in pickup.students] if pickup.students else []
    if student_id not in current_student_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta persona no está autorizada para este estudiante",
        )

    # Remove only this student from the pickup's list
    new_student_ids = [sid for sid in current_student_ids if sid != student_id]
    await repo.set_students(pickup_id, new_student_ids)
    await session.commit()

    return {"message": "Persona autorizada removida del estudiante"}
