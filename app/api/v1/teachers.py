"""Teacher endpoints for PWA and admin CRUD."""

import csv
from datetime import UTC, datetime
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.core.deps import TenantAuthUser
from app.db.repositories.attendance import AttendanceRepository
from app.db.repositories.teachers import TeacherRepository
from app.schemas.teachers import (
    BulkAttendanceRequest,
    BulkAttendanceResponse,
    PaginatedTeachers,
    TeacherCourseRead,
    TeacherCreate,
    TeacherFilters,
    TeacherMeResponse,
    TeacherRead,
    TeacherStudentRead,
    TeacherUpdate,
    TeacherWithStats,
)
from app.services.teacher_service import TeacherService

limiter = Limiter(key_func=get_remote_address)


router = APIRouter()

# Roles that can access teacher endpoints
# Directors, inspectors, admins often teach classes in small schools
TEACHER_PORTAL_ROLES = ("TEACHER", "DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN")


def get_teacher_repo(session: AsyncSession = Depends(deps.get_tenant_db)) -> TeacherRepository:
    return TeacherRepository(session)


def get_attendance_repo(
    session: AsyncSession = Depends(deps.get_tenant_db),
) -> AttendanceRepository:
    return AttendanceRepository(session)


@router.get("/me", response_model=TeacherMeResponse)
async def get_current_teacher(
    user: AuthUser = Depends(deps.get_current_user),
    repo: TeacherRepository = Depends(get_teacher_repo),
) -> TeacherMeResponse:
    """Get current teacher's information and assigned courses.

    Requires a role with teacher portal access. Directors/Admins without
    a teacher profile get access to all courses.
    """
    if user.role not in TEACHER_PORTAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder al portal de profesores",
        )

    # If user has teacher_id, return their teacher profile
    if user.teacher_id:
        teacher = await repo.get_with_courses(user.teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )
        return TeacherMeResponse(
            teacher=TeacherRead.model_validate(teacher),
            courses=[TeacherCourseRead.model_validate(c) for c in teacher.courses],
        )

    # Admin roles without teacher_id get a virtual profile with all courses
    if user.role in ("DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN"):
        all_courses = await repo.list_all_courses()
        # Create a virtual teacher profile for the admin
        virtual_teacher = TeacherRead(
            id=0,  # Virtual ID for admin
            full_name=user.full_name or "Administrador",
            email=None,
            status="ACTIVE",
        )
        return TeacherMeResponse(
            teacher=virtual_teacher,
            courses=[TeacherCourseRead.model_validate(c) for c in all_courses],
        )

    # Regular TEACHER role without teacher_id
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Usuario no tiene perfil de profesor asociado",
    )


@router.get("/courses/{course_id}/students", response_model=list[TeacherStudentRead])
async def list_course_students(
    # TDD-R6-BUG4 fix: Validate course_id path parameter
    course_id: int = Path(..., ge=1),
    user: AuthUser = Depends(deps.get_current_user),
    repo: TeacherRepository = Depends(get_teacher_repo),
) -> list[TeacherStudentRead]:
    """List students in a course.

    Teachers can only see students in courses assigned to them.
    Directors/Admins can see students in any course.
    """
    if user.role not in TEACHER_PORTAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder al portal de profesores",
        )

    # Admin roles can access any course
    if user.role in ("DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN") and not user.teacher_id:
        students = await repo.list_all_course_students(course_id)
        return [TeacherStudentRead.model_validate(s) for s in students]

    # Regular teacher or admin with teacher profile
    if not user.teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene perfil de profesor asociado",
        )

    students = await repo.list_course_students(user.teacher_id, course_id)
    if not students:
        # Check if it's because teacher isn't assigned or course has no students
        teacher = await repo.get_with_courses(user.teacher_id)
        if teacher:
            course_ids = {c.id for c in teacher.courses}
            if course_id not in course_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes acceso a este curso",
                )

    return [TeacherStudentRead.model_validate(s) for s in students]


@router.post("/attendance/bulk", response_model=BulkAttendanceResponse)
async def submit_bulk_attendance(
    payload: BulkAttendanceRequest,
    user: AuthUser = Depends(deps.get_current_user),
    teacher_repo: TeacherRepository = Depends(get_teacher_repo),
    attendance_repo: AttendanceRepository = Depends(get_attendance_repo),
    session: AsyncSession = Depends(deps.get_tenant_db),
) -> BulkAttendanceResponse:
    """Submit multiple attendance events at once.

    Used by teacher PWA to sync offline attendance records.
    Directors/Admins can submit attendance for any course.
    """
    if user.role not in TEACHER_PORTAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder al portal de profesores",
        )

    # Admin roles without teacher_id can submit for any course
    is_admin_without_profile = (
        user.role in ("DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN") and not user.teacher_id
    )

    if not is_admin_without_profile:
        if not user.teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario no tiene perfil de profesor asociado",
            )

        # Verify teacher has access to this course
        teacher = await teacher_repo.get_with_courses(user.teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        course_ids = {c.id for c in teacher.courses}
        if payload.course_id not in course_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este curso",
            )

    processed = 0
    errors: list[str] = []

    for item in payload.events:
        try:
            occurred_at = (
                datetime.fromisoformat(item.occurred_at) if item.occurred_at else datetime.now(UTC)
            )

            await attendance_repo.create_event(
                student_id=item.student_id,
                event_type=item.type,
                gate_id=payload.gate_id,
                device_id=payload.device_id,
                occurred_at=occurred_at,
                source="MANUAL",  # Teacher bulk registration is always manual
            )
            processed += 1
        except Exception as e:
            errors.append(f"student_id={item.student_id}: {str(e)}")

    await session.commit()

    return BulkAttendanceResponse(processed=processed, errors=errors)


# =============================================================================
# Admin CRUD Endpoints (Director, Admin, Inspector)
# =============================================================================


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection."""
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@|":
        return "'" + val
    return val


# NOTE: Export and search endpoints MUST be defined BEFORE /{teacher_id}
# to avoid route conflicts with FastAPI


@router.get("/export", response_class=Response)
@limiter.limit("10/minute")
async def export_teachers(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Export teachers to CSV file."""
    filters = TeacherFilters(status=status_filter)
    teachers = await service.list_teachers_for_export(user, filters, request)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["ID", "Nombre", "Email", "Estado", "Cursos", "Puede Inscribir Biom.", "Creado"]
    )

    for t in teachers:
        writer.writerow(
            [
                t.id,
                _sanitize_csv_value(t.full_name),
                _sanitize_csv_value(t.email) if t.email else "",
                t.status,
                t.courses_count,
                "Sí" if t.can_enroll_biometric else "No",
                t.created_at.isoformat() if t.created_at else "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=profesores.csv"},
    )


@router.get("/search", response_model=list[TeacherRead])
@limiter.limit("60/minute")
async def search_teachers(
    request: Request,
    q: str = Query(..., min_length=2, description="Término de búsqueda"),
    limit: int = Query(20, ge=1, le=50, description="Máximo de resultados"),
    fuzzy: bool = Query(False, description="Usar búsqueda difusa"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[TeacherRead]:
    """Search teachers by name or email."""
    return await service.search_teachers(user, q, limit=limit, fuzzy=fuzzy)


@router.get("", response_model=PaginatedTeachers)
@limiter.limit("60/minute")
async def list_teachers(
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Registros por página"),
    offset: int = Query(0, ge=0, description="Registros a saltar"),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(None, min_length=2, description="Buscar por nombre o email"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedTeachers:
    """List teachers with pagination and filters."""
    filters = TeacherFilters(status=status_filter, search=search)
    return await service.list_teachers(user, filters, limit=limit, offset=offset)


@router.post("", response_model=TeacherRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_teacher(
    request: Request,
    payload: TeacherCreate,
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> TeacherRead:
    """Create a new teacher."""
    return await service.create_teacher(user, payload, request)


@router.get("/{teacher_id}", response_model=TeacherWithStats)
@limiter.limit("60/minute")
async def get_teacher(
    request: Request,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> TeacherWithStats:
    """Get a teacher by ID with statistics."""
    return await service.get_teacher_detail(user, teacher_id, request)


@router.patch("/{teacher_id}", response_model=TeacherRead)
@limiter.limit("30/minute")
async def update_teacher(
    request: Request,
    payload: TeacherUpdate,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> TeacherRead:
    """Update a teacher's information."""
    return await service.update_teacher(user, teacher_id, payload, request)


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_teacher(
    request: Request,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Soft delete a teacher (marks as DELETED)."""
    await service.delete_teacher(user, teacher_id, request)


@router.patch("/{teacher_id}/restore", response_model=TeacherRead)
@limiter.limit("10/minute")
async def restore_teacher(
    request: Request,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> TeacherRead:
    """Restore a deleted teacher."""
    return await service.restore_teacher(user, teacher_id, request)


@router.post("/{teacher_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def assign_course_to_teacher(
    request: Request,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    course_id: int = Path(..., ge=1, description="ID del curso"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Assign a course to a teacher."""
    await service.assign_course(user, teacher_id, course_id, request)


@router.delete("/{teacher_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def unassign_course_from_teacher(
    request: Request,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    course_id: int = Path(..., ge=1, description="ID del curso"),
    service: TeacherService = Depends(deps.get_teacher_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Remove a course assignment from a teacher."""
    await service.unassign_course(user, teacher_id, course_id, request)
