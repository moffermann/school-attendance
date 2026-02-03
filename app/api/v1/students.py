"""Student management endpoints."""

import csv
import io
from io import StringIO

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Request, Response, UploadFile, status
from loguru import logger
from PIL import Image

from app.core import deps
from app.core.deps import TenantAuthUser
from app.core.rate_limiter import limiter
from app.schemas.students import (
    PaginatedStudents,
    StudentCreate,
    StudentDeleteResponse,
    StudentFilters,
    StudentPhotoResponse,
    StudentRead,
    StudentUpdate,
    StudentWithStats,
)
from app.services.student_service import StudentService


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
    """Build a proxy URL for accessing photos through the API.

    Uses a relative URL to avoid cross-origin issues when accessing from
    different origins (localhost vs external IP vs domain).
    """
    if not photo_key:
        return None
    # Use relative URL - works regardless of how user accesses the server
    return f"/api/v1/photos/{photo_key}"


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection."""
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@|":
        return "'" + val
    return val


# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
# HEIC types from iPhones (added conditionally based on support)
HEIC_MIME_TYPES = {"image/heic", "image/heif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def _convert_heic_to_jpeg(content: bytes) -> tuple[bytes, str]:
    """Convert HEIC/HEIF image to JPEG format.

    Returns tuple of (jpeg_bytes, content_type).
    """
    img: Image.Image = Image.open(io.BytesIO(content))
    # Convert to RGB if necessary (HEIC may have alpha)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=85)
    output.seek(0)
    return output.read(), "image/jpeg"


# =============================================================================
# STATIC ROUTES FIRST (before path parameter routes)
# =============================================================================


@router.get("/export", response_class=Response)
@limiter.limit("10/minute")
async def export_students(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    course_filter: int | None = Query(default=None, alias="course_id", ge=1),
    include_deleted: bool = Query(default=False),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Export students to CSV.

    - **status**: Filter by status (ACTIVE, INACTIVE, DELETED)
    - **course_id**: Filter by course
    - **include_deleted**: Include deleted students
    """
    filters = StudentFilters(
        status=status_filter,
        course_id=course_filter,
        include_deleted=include_deleted,
    )
    students = await service.list_students_for_export(user, filters, request)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "ID", "Nombre", "RUT/ID Nacional", "Curso",
        "Estado", "Apoderados", "Eventos Asistencia", "Creado"
    ])

    for s in students:
        writer.writerow([
            s.id,
            _sanitize_csv_value(s.full_name),
            _sanitize_csv_value(s.national_id) if s.national_id else "",
            _sanitize_csv_value(s.course_name) if s.course_name else "",
            s.status,
            s.guardians_count,
            s.attendance_events_count,
            s.created_at.isoformat() if s.created_at else "",
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=estudiantes.csv"},
    )


@router.get("/search")
@limiter.limit("60/minute")
async def search_students(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100, description="Search query"),
    limit: int = Query(20, ge=1, le=50, description="Max results"),
    fuzzy: bool = Query(False, description="Use fuzzy matching with ranking"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[StudentRead]:
    """Search students by name or national ID.

    - **q**: Search query (min 2 chars)
    - **limit**: Maximum results (default 20)
    - **fuzzy**: Enable fuzzy search with relevance ranking
    """
    return await service.search_students(user, q, limit=limit, fuzzy=fuzzy)


# =============================================================================
# MAIN CRUD ROUTES
# =============================================================================


@router.get("", response_model=PaginatedStudents)
@limiter.limit("60/minute")
async def list_students(
    request: Request,
    skip: int = Query(0, ge=0, alias="offset", description="Registros a omitir (offset)"),
    limit: int = Query(50, ge=1, le=200, description="Maximo de registros (1-200)"),
    q: str | None = Query(None, min_length=2, max_length=100, alias="search", description="Buscar por nombre o RUT"),
    course_id: int | None = Query(None, ge=1, description="Filtrar por curso"),
    status_filter: str | None = Query(None, alias="status", description="Filtrar por estado (ACTIVE, INACTIVE, DELETED)"),
    include_deleted: bool = Query(False, description="Incluir eliminados"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedStudents:
    """List students with pagination and search.

    - **search**: Search by name or national ID (case-insensitive, min 2 chars)
    - **course_id**: Filter by course
    - **status**: Filter by status (default: all except DELETED)
    - **offset/limit**: Pagination controls
    """
    filters = StudentFilters(
        search=q,
        course_id=course_id,
        status=status_filter,
        include_deleted=include_deleted,
    )
    return await service.list_students(user, filters, limit=limit, offset=skip)


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_student(
    request: Request,
    payload: StudentCreate,
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> StudentRead:
    """Create a new student.

    - **full_name**: Student's full name (required, 2-255 chars)
    - **course_id**: Course/class ID (required)
    - **national_id**: National ID/RUT (optional)
    - **evidence_preference**: Evidence type preference (photo/audio/none)
    """
    return await service.create_student(user, payload, request)


@router.get("/{student_id}", response_model=StudentWithStats)
@limiter.limit("60/minute")
async def get_student(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> StudentWithStats:
    """Get a student by ID with statistics."""
    student = await service.get_student_detail(user, student_id, request)
    # Add presigned URL for photo
    student.photo_presigned_url = _build_photo_proxy_url(student.photo_url)
    return student


@router.patch("/{student_id}", response_model=StudentRead)
@limiter.limit("30/minute")
async def update_student(
    request: Request,
    payload: StudentUpdate,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> StudentRead:
    """Update a student's information."""
    return await service.update_student(user, student_id, payload, request)


@router.delete("/{student_id}", response_model=StudentDeleteResponse)
@limiter.limit("10/minute")
async def delete_student(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> StudentDeleteResponse:
    """Soft delete a student (marks as DELETED).

    The student record is preserved for historical queries and auditing.
    The student will no longer appear in normal listings.

    Returns warnings if the student has attendance records or linked guardians.
    """
    return await service.delete_student(user, student_id, request)


@router.post("/{student_id}/restore", response_model=StudentRead)
@limiter.limit("10/minute")
async def restore_student(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> StudentRead:
    """Restore a soft-deleted student.

    Changes the student status from DELETED back to ACTIVE.
    """
    return await service.restore_student(user, student_id, request)


# =============================================================================
# PHOTO ROUTES
# =============================================================================


@router.post("/{student_id}/photo", response_model=StudentPhotoResponse)
@limiter.limit("30/minute")
async def upload_student_photo(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    file: UploadFile = File(...),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
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

    # Delegate to service
    try:
        student = await service.upload_photo(user, student_id, content, content_type, request)

        return StudentPhotoResponse(
            id=student.id,
            full_name=student.full_name,
            photo_url=student.photo_url,
            photo_presigned_url=_build_photo_proxy_url(student.photo_url),
        )
    finally:
        service.close()


@router.delete("/{student_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_student_photo(
    request: Request,
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: StudentService = Depends(deps.get_student_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Delete a student's profile photo."""
    try:
        await service.delete_photo(user, student_id, request)
    finally:
        service.close()
