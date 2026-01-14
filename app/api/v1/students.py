"""Student management endpoints."""

import io
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, UploadFile, File, status
from loguru import logger
from PIL import Image
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.repositories.students import StudentRepository
from app.services.photo_service import PhotoService

# Register HEIC support with Pillow
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False
    logger.warning("pillow-heif not installed, HEIC support disabled")


router = APIRouter()


def _build_photo_proxy_url(photo_key: str | None) -> str | None:
    """Build a proxy URL for accessing photos through the API."""
    if not photo_key:
        return None
    base_url = str(settings.public_base_url).rstrip('/')
    return f"{base_url}/api/v1/photos/{photo_key}"


# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
# HEIC types from iPhones (added conditionally based on support)
HEIC_MIME_TYPES = {"image/heic", "image/heif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def _convert_heic_to_jpeg(content: bytes) -> tuple[bytes, str]:
    """Convert HEIC/HEIF image to JPEG format.

    Returns tuple of (jpeg_bytes, content_type).
    """
    img = Image.open(io.BytesIO(content))
    # Convert to RGB if necessary (HEIC may have alpha)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=85)
    output.seek(0)
    return output.read(), "image/jpeg"


class StudentPhotoResponse(BaseModel):
    """Response schema for student photo upload."""
    id: int
    full_name: str
    photo_url: str | None
    photo_presigned_url: str | None


class StudentCreateRequest(BaseModel):
    """Request schema for creating a student."""
    full_name: str = Field(..., min_length=2, max_length=255, description="Nombre completo del estudiante")
    course_id: int = Field(..., ge=1, description="ID del curso")
    national_id: str | None = Field(None, max_length=20, description="RUT o documento de identidad")
    evidence_preference: Literal["photo", "audio", "none"] = Field("none", description="Preferencia de evidencia")


class StudentUpdateRequest(BaseModel):
    """Request schema for updating a student."""
    full_name: str | None = None
    national_id: str | None = None
    course_id: int | None = Field(None, ge=1, description="ID del curso")
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


class StudentListItem(BaseModel):
    """Schema for student in list response."""
    id: int
    full_name: str
    national_id: str | None
    course_id: int
    status: str
    photo_url: str | None
    photo_presigned_url: str | None
    evidence_preference: str


class StudentListResponse(BaseModel):
    """Paginated response for student list."""
    items: list[StudentListItem] = Field(default_factory=list)
    total: int = Field(..., ge=0, description="Total de estudiantes que coinciden con los filtros")
    skip: int = Field(..., ge=0, description="Registros omitidos")
    limit: int = Field(..., ge=1, description="Limite de registros por pagina")
    has_more: bool = Field(..., description="Indica si hay mas registros disponibles")


@router.get("", response_model=StudentListResponse)
async def list_students(
    skip: int = Query(0, ge=0, description="Registros a omitir (offset)"),
    limit: int = Query(50, ge=1, le=200, description="Maximo de registros (1-200)"),
    q: str | None = Query(None, min_length=2, max_length=100, description="Buscar por nombre o RUT"),
    course_id: int | None = Query(None, ge=1, description="Filtrar por curso"),
    status: str | None = Query(None, description="Filtrar por estado (ACTIVE, INACTIVE)"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> StudentListResponse:
    """List students with pagination and search.

    - **q**: Search by name or national ID (case-insensitive, min 2 chars)
    - **course_id**: Filter by course
    - **status**: Filter by status (default: all)
    - **skip/limit**: Pagination controls
    """
    repo = StudentRepository(session)
    # Si se solicita DELETED explícitamente, incluir eliminados
    include_deleted = status == "DELETED"
    students, total = await repo.list_paginated(
        skip=skip,
        limit=limit,
        search=q,
        course_id=course_id,
        status=status,
        include_deleted=include_deleted,
    )

    items = [
        StudentListItem(
            id=s.id,
            full_name=s.full_name,
            national_id=s.national_id,
            course_id=s.course_id,
            status=s.status,
            photo_url=s.photo_url,
            photo_presigned_url=_build_photo_proxy_url(s.photo_url),
            evidence_preference=s.evidence_preference or "none",
        )
        for s in students
    ]

    return StudentListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    payload: StudentCreateRequest,
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> StudentResponse:
    """Create a new student.

    - **full_name**: Student's full name (required, 2-255 chars)
    - **course_id**: Course/class ID (required)
    - **national_id**: National ID/RUT (optional)
    - **evidence_preference**: Evidence type preference (photo/audio/none)
    """
    repo = StudentRepository(session)

    # Create the student
    student = await repo.create(
        full_name=payload.full_name,
        course_id=payload.course_id,
        national_id=payload.national_id,
        evidence_preference=payload.evidence_preference,
    )
    await session.commit()

    logger.info(f"Created student {student.id}: {student.full_name}")

    return StudentResponse(
        id=student.id,
        full_name=student.full_name,
        national_id=student.national_id,
        course_id=student.course_id,
        status=student.status,
        photo_url=student.photo_url,
        photo_presigned_url=None,
        evidence_preference=student.evidence_preference or "none",
    )


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> StudentResponse:
    """Get a student by ID."""
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student or student.status == "DELETED":
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

    if not student or student.status == "DELETED":
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
    if payload.course_id is not None:
        update_data["course_id"] = payload.course_id
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


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Soft delete a student (marks as DELETED).

    The student record is preserved for historical queries and auditing.
    The student will no longer appear in normal listings.
    """
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    if student.status == "DELETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estudiante ya fue eliminado"
        )

    # Soft delete - mark as DELETED
    await repo.soft_delete(student_id)
    await session.commit()

    logger.info(f"Soft deleted student {student_id}: {student.full_name}")


@router.post("/{student_id}/restore", response_model=StudentResponse)
async def restore_student(
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> StudentResponse:
    """Restore a soft-deleted student.

    Changes the student status from DELETED back to ACTIVE.
    """
    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    if student.status != "DELETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estudiante no está eliminado"
        )

    # Restore - mark as ACTIVE
    student = await repo.update(student_id, status="ACTIVE")
    await session.commit()

    logger.info(f"Restored student {student_id}: {student.full_name}")

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
    """Upload or update a student's profile photo.

    Supports JPEG, PNG, WebP, and HEIC (iPhone) formats.
    HEIC images are automatically converted to JPEG.
    """
    content_type = file.content_type
    is_heic = content_type in HEIC_MIME_TYPES

    # Validate file type
    all_allowed = ALLOWED_IMAGE_TYPES | (HEIC_MIME_TYPES if HEIC_SUPPORTED else set())
    if content_type not in all_allowed:
        allowed_list = ", ".join(sorted(all_allowed))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Use: {allowed_list}"
        )

    # Check HEIC support
    if is_heic and not HEIC_SUPPORTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato HEIC no soportado. Por favor convierta a JPEG."
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archivo demasiado grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Convert HEIC to JPEG
    if is_heic:
        try:
            content, content_type = _convert_heic_to_jpeg(content)
            logger.info(f"Converted HEIC to JPEG for student {student_id}")
        except Exception as e:
            logger.error(f"Failed to convert HEIC: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al convertir imagen HEIC. Por favor use otro formato."
            ) from e

    repo = StudentRepository(session)
    student = await repo.get(student_id)

    if not student or student.status == "DELETED":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado"
        )

    # Generate unique key for S3 (always jpg for converted HEIC)
    extension = content_type.split("/")[-1]
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

        # Store new photo (content_type may be changed if converted from HEIC)
        await photo_service.store_photo(photo_key, content, content_type)

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

    if not student or student.status == "DELETED":
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
