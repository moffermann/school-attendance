"""Parent-facing endpoints for managing authorized pickups.

Parents can create, view, edit, and deactivate adults authorized
to pick up their children, as well as regenerate QR codes.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Request, UploadFile, File, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.deps import TenantAuthUser
from app.db.repositories.authorized_pickups import AuthorizedPickupRepository
from app.db.repositories.guardians import GuardianRepository

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


# ==================== Schemas ====================


class ParentPickupCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    relationship_type: str = Field(..., min_length=2, max_length=100)
    national_id: str | None = Field(None, max_length=20)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    student_ids: list[int] = Field(..., min_length=1)


class ParentPickupUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    relationship_type: str | None = Field(None, min_length=2, max_length=100)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    student_ids: list[int] | None = None


class ParentPickupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    relationship_type: str
    national_id: str | None
    phone: str | None
    email: str | None
    photo_url: str | None
    is_active: bool
    student_ids: list[int]
    has_qr: bool
    has_photo: bool


class ParentPickupQRResponse(ParentPickupResponse):
    """Extended response returned after QR regeneration, includes the one-time token."""

    qr_token: str


# ==================== Helpers ====================


def _require_parent_or_admin(user: TenantAuthUser, guardian_id: int) -> None:
    """Validate user owns this guardian or is staff."""
    if user.role in ("ADMIN", "DIRECTOR", "INSPECTOR"):
        return
    if user.role != "PARENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    if user.guardian_id != guardian_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")


async def _get_guardian_student_ids(
    session: AsyncSession, guardian_id: int
) -> set[int]:
    """Return the set of student IDs belonging to this guardian."""
    repo = GuardianRepository(session)
    guardian = await repo.get(guardian_id)
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Apoderado no encontrado"
        )
    return {s.id for s in guardian.students} if guardian.students else set()


def _build_photo_proxy_url(photo_key: str | None) -> str | None:
    """Build a proxy URL for accessing photos through the API."""
    if not photo_key:
        return None
    return f"/api/v1/photos/{photo_key}"


def _pickup_to_response(pickup) -> ParentPickupResponse:
    return ParentPickupResponse(
        id=pickup.id,
        full_name=pickup.full_name,
        relationship_type=pickup.relationship_type,
        national_id=pickup.national_id,
        phone=pickup.phone,
        email=pickup.email,
        photo_url=_build_photo_proxy_url(pickup.photo_url),
        is_active=pickup.is_active,
        student_ids=[s.id for s in pickup.students] if pickup.students else [],
        has_qr=bool(pickup.qr_code_hash),
        has_photo=bool(pickup.photo_url),
    )


# ==================== Endpoints ====================


@router.get("", response_model=list[ParentPickupResponse])
@limiter.limit("30/minute")
async def list_parent_pickups(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[ParentPickupResponse]:
    """List authorized pickups visible to this guardian."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)
    if not guardian_student_ids:
        return []

    repo = AuthorizedPickupRepository(session)
    # Collect pickups across all students of this guardian
    seen: dict[int, object] = {}
    for sid in guardian_student_ids:
        pickups = await repo.list_by_student(sid)
        for p in pickups:
            if p.id not in seen:
                seen[p.id] = p

    return [_pickup_to_response(p) for p in seen.values()]


@router.post("", response_model=ParentPickupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_parent_pickup(
    request: Request,
    payload: ParentPickupCreate,
    guardian_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupResponse:
    """Create a new authorized pickup for this guardian's students."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    # Validate student_ids belong to this guardian
    requested = set(payload.student_ids)
    if not requested.issubset(guardian_student_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="student_ids contiene estudiantes que no pertenecen a este apoderado",
        )

    repo = AuthorizedPickupRepository(session)

    # Check for existing by national_id
    existing = None
    if payload.national_id:
        existing = await repo.get_by_national_id(payload.national_id)

    if existing:
        # Merge student_ids
        current_ids = [s.id for s in existing.students] if existing.students else []
        merged = list(set(current_ids) | requested)
        await repo.set_students(existing.id, merged)
        await session.commit()
        pickup = await repo.get(existing.id)
    else:
        pickup = await repo.create(
            full_name=payload.full_name,
            relationship_type=payload.relationship_type,
            national_id=payload.national_id,
            phone=payload.phone,
            email=payload.email,
            created_by_user_id=user.id,
        )
        await repo.set_students(pickup.id, list(requested))
        await session.commit()
        pickup = await repo.get(pickup.id)

    return _pickup_to_response(pickup)


@router.get("/{pickup_id}", response_model=ParentPickupResponse)
async def get_parent_pickup(
    guardian_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupResponse:
    """Get a single authorized pickup detail."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    # Verify pickup is linked to at least one of this guardian's students
    pickup_student_ids = {s.id for s in pickup.students} if pickup.students else set()
    if not pickup_student_ids & guardian_student_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    return _pickup_to_response(pickup)


@router.patch("/{pickup_id}", response_model=ParentPickupResponse)
@limiter.limit("20/minute")
async def update_parent_pickup(
    request: Request,
    payload: ParentPickupUpdate,
    guardian_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupResponse:
    """Update an authorized pickup's data."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    # Verify ownership
    pickup_student_ids = {s.id for s in pickup.students} if pickup.students else set()
    if not pickup_student_ids & guardian_student_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    update_data: dict = {}
    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name
    if payload.relationship_type is not None:
        update_data["relationship_type"] = payload.relationship_type
    if payload.phone is not None:
        update_data["phone"] = payload.phone
    if payload.email is not None:
        update_data["email"] = payload.email

    if update_data:
        await repo.update(pickup_id, **update_data)

    # Update student associations if provided
    if payload.student_ids is not None:
        requested = set(payload.student_ids)
        if not requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe tener al menos un alumno asociado",
            )
        if not requested.issubset(guardian_student_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="student_ids contiene estudiantes que no pertenecen a este apoderado",
            )
        await repo.set_students(pickup_id, list(requested))

    await session.commit()
    pickup = await repo.get(pickup_id)
    return _pickup_to_response(pickup)


@router.delete("/{pickup_id}", response_model=ParentPickupResponse)
@limiter.limit("10/minute")
async def deactivate_parent_pickup(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupResponse:
    """Deactivate an authorized pickup (soft delete)."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    pickup_student_ids = {s.id for s in pickup.students} if pickup.students else set()
    if not pickup_student_ids & guardian_student_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    if not pickup.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La persona ya está desactivada"
        )

    await repo.deactivate(pickup_id)
    await session.commit()
    pickup = await repo.get(pickup_id)
    return _pickup_to_response(pickup)


@router.post("/{pickup_id}/regenerate-qr", response_model=ParentPickupQRResponse)
@limiter.limit("5/minute")
async def regenerate_parent_pickup_qr(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupQRResponse:
    """Regenerate QR code for an authorized pickup."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    pickup_student_ids = {s.id for s in pickup.students} if pickup.students else set()
    if not pickup_student_ids & guardian_student_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    result = await repo.regenerate_qr(pickup_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    _, qr_token = result
    await session.commit()
    pickup = await repo.get(pickup_id)

    resp = _pickup_to_response(pickup)
    return ParentPickupQRResponse(**resp.model_dump(), qr_token=qr_token)


@router.post("/{pickup_id}/photo", response_model=ParentPickupResponse)
@limiter.limit("10/minute")
async def upload_parent_pickup_photo(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    pickup_id: int = Path(..., gt=0),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> ParentPickupResponse:
    """Upload a photo for an authorized pickup."""
    _require_parent_or_admin(user, guardian_id)

    guardian_student_ids = await _get_guardian_student_ids(session, guardian_id)

    repo = AuthorizedPickupRepository(session)
    pickup = await repo.get(pickup_id)
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona autorizada no encontrada"
        )

    pickup_student_ids = {s.id for s in pickup.students} if pickup.students else set()
    if not pickup_student_ids & guardian_student_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    # Validate file type
    content_type = file.content_type or "image/jpeg"
    if content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no soportado. Use JPEG, PNG o WebP.",
        )

    # Read file content
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen no puede superar 5MB"
        )

    # Store in S3/MinIO
    from app.services.photo_service import PhotoService

    photo_service = PhotoService()
    try:
        ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
        key = f"pickups/{pickup_id}/photo.{ext}"
        await photo_service.store_photo(key, content, content_type)
        await repo.update(pickup_id, photo_url=key)
        await session.commit()
        pickup = await repo.get(pickup_id)
        return _pickup_to_response(pickup)
    finally:
        photo_service.close()
