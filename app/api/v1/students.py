"""Student management endpoints."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Request, UploadFile, File, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.repositories.students import StudentRepository
from app.services.photo_service import PhotoService


router = APIRouter()


def _build_photo_proxy_url(photo_key: str | None) -> str | None:
    """Build a proxy URL for accessing photos through the API."""
    if not photo_key:
        return None
    base_url = str(settings.public_base_url).rstrip('/')
    return f"{base_url}/api/v1/photos/{photo_key}"


# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


class StudentPhotoResponse(BaseModel):
    """Response schema for student photo upload."""
    id: int
    full_name: str
    photo_url: str | None
    photo_presigned_url: str | None


class StudentUpdateRequest(BaseModel):
    """Request schema for updating a student."""
    full_name: str | None = None
    national_id: str | None = None
    evidence_preference: Literal["photo", "audio", "none"] | None = None


class StudentResponse(BaseModel):
    """Response schema for student data."""
    id: int
    full_name: str
    national_id: str | None
    course_id: int
    status: str
    photo_url: str | None
    photo_presigned_url: str | None
    evidence_preference: str


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> StudentResponse:
    """Get a student by ID."""
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    # Build proxy URL for photo access (works through tunnel)
    photo_presigned_url = _build_photo_proxy_url(student.photo_url)

    return StudentResponse(
        id=student.id,
        full_name=student.full_name,
        national_id=student.national_id,
        course_id=student.course_id,
        status=student.status,
        photo_url=student.photo_url,
        photo_presigned_url=photo_presigned_url,
        evidence_preference=student.evidence_preference or "none",
    )


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    payload: StudentUpdateRequest,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> StudentResponse:
    """Update a student's information."""
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    # Build update dict with only provided fields
    update_data = {}
    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name
    if payload.national_id is not None:
        update_data["national_id"] = payload.national_id
    if payload.evidence_preference is not None:
        update_data["evidence_preference"] = payload.evidence_preference

    if update_data:
        student = await repo.update(student_id, **update_data)
        await session.commit()

    # Build proxy URL for photo access (works through tunnel)
    photo_presigned_url = _build_photo_proxy_url(student.photo_url)

    return StudentResponse(
        id=student.id,
        full_name=student.full_name,
        national_id=student.national_id,
        course_id=student.course_id,
        status=student.status,
        photo_url=student.photo_url,
        photo_presigned_url=photo_presigned_url,
        evidence_preference=student.evidence_preference or "none",
    )


@router.post("/{student_id}/photo", response_model=StudentPhotoResponse)
@limiter.limit("30/minute")
async def upload_student_photo(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> StudentPhotoResponse:
    """Upload or update a student's profile photo."""
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Use: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archivo demasiado grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    # Generate unique key for S3
    extension = file.content_type.split("/")[-1]
    if extension == "jpeg":
        extension = "jpg"
    photo_key = f"students/{student_id}/profile_{uuid.uuid4().hex[:8]}.{extension}"

    photo_service = PhotoService()
    try:
        # Delete old photo if exists
        if student.photo_url:
            try:
                await photo_service.delete_photo(student.photo_url)
                logger.info(f"Deleted old photo for student {student_id}: {student.photo_url}")
            except Exception as e:
                logger.warning(f"Failed to delete old photo for student {student_id}: {e}")

        # Store new photo
        await photo_service.store_photo(photo_key, content, file.content_type)

        # Update student record
        await repo.update_photo_url(student_id, photo_key)
        await session.commit()

        logger.info(f"Uploaded photo for student {student_id}: {photo_key}")

        # Build proxy URL for immediate access (works through tunnel)
        return StudentPhotoResponse(
            id=student.id,
            full_name=student.full_name,
            photo_url=photo_key,
            photo_presigned_url=_build_photo_proxy_url(photo_key),
        )
    except Exception as e:
        logger.error(f"Failed to upload photo for student {student_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al subir la foto"
        ) from e
    finally:
        photo_service.close()


@router.delete("/{student_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_photo(
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Delete a student's profile photo."""
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    if not student.photo_url:
        return  # No photo to delete

    photo_service = PhotoService()
    try:
        await photo_service.delete_photo(student.photo_url)
        await repo.update_photo_url(student_id, None)
        await session.commit()
        logger.info(f"Deleted photo for student {student_id}")
    except Exception as e:
        logger.error(f"Failed to delete photo for student {student_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la foto"
        ) from e
    finally:
        photo_service.close()
