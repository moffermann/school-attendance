"""Course management endpoints."""

import csv
from io import StringIO

from fastapi import APIRouter, Depends, Path, Query, Request, status
from fastapi.responses import Response

from app.core import deps
from app.core.deps import TenantAuthUser
from app.core.rate_limiter import limiter
from app.schemas.courses import (
    CourseCreate,
    CourseFilters,
    CourseRead,
    CourseUpdate,
    CourseWithStats,
    PaginatedCourses,
)
from app.services.course_service import CourseService

router = APIRouter()


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection.

    Excel and other spreadsheets interpret cells starting with =, +, -, @, |
    as formulas, which can be exploited for code execution.
    """
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@|":
        return "'" + val  # Prefix with quote to prevent formula interpretation
    return val


@router.get("", response_model=PaginatedCourses)
@limiter.limit("60/minute")
async def list_courses(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Items to skip"),
    grade: str | None = Query(None, max_length=32, description="Filter by grade"),
    status_filter: str = Query(
        default="ACTIVE", alias="status", description="Filter by status"
    ),
    search: str | None = Query(
        None, max_length=100, description="Search in name/grade"
    ),
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedCourses:
    """List courses with pagination and filters.

    Rate limit: 60 requests per minute.
    """
    filters = CourseFilters(grade=grade, status=status_filter, search=search)
    return await service.list_courses(user, filters, limit=limit, offset=offset)


@router.get("/export", response_class=Response)
@limiter.limit("10/minute")
async def export_courses(
    request: Request,
    grade: str | None = Query(None, max_length=32, description="Filter by grade"),
    status_filter: str = Query(
        default="ACTIVE", alias="status", description="Filter by status"
    ),
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Export courses to CSV.

    Rate limit: 10 requests per minute.
    """
    filters = CourseFilters(grade=grade, status=status_filter)
    courses = await service.list_courses_for_export(user, filters, request)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["ID", "Nombre", "Grado", "Estado", "Alumnos", "Horarios", "Inscripciones", "Creado"]
    )

    for course in courses:
        writer.writerow(
            [
                course.id,
                _sanitize_csv_value(course.name),
                _sanitize_csv_value(course.grade),
                course.status,
                course.active_students_count,
                course.schedules_count,
                course.enrollments_count,
                course.created_at.isoformat() if course.created_at else "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cursos.csv"},
    )


@router.get("/search", response_model=list[CourseRead])
@limiter.limit("60/minute")
async def search_courses(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(default=20, ge=1, le=50, description="Max results"),
    fuzzy: bool = Query(default=False, description="Use fuzzy search"),
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[CourseRead]:
    """Search courses by name/grade.

    Rate limit: 60 requests per minute.
    Set fuzzy=true for tolerant matching with ranking.
    """
    return await service.search_courses(user, q, limit=limit, fuzzy=fuzzy)


@router.get("/{course_id}", response_model=CourseWithStats)
@limiter.limit("60/minute")
async def get_course(
    request: Request,
    course_id: int = Path(..., ge=1, description="Course ID"),
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> CourseWithStats:
    """Get course detail with statistics.

    Rate limit: 60 requests per minute.
    """
    return await service.get_course_detail(user, course_id, request)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_course(
    request: Request,
    payload: CourseCreate,
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> CourseRead:
    """Create a new course.

    Rate limit: 30 requests per minute.
    Requires ADMIN or DIRECTOR role.
    """
    return await service.create_course(user, payload, request)


@router.patch("/{course_id}", response_model=CourseRead)
@limiter.limit("30/minute")
async def update_course(
    request: Request,
    course_id: int = Path(..., ge=1, description="Course ID"),
    payload: CourseUpdate = ...,
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> CourseRead:
    """Update a course.

    Rate limit: 30 requests per minute.
    Requires ADMIN or DIRECTOR role.
    """
    return await service.update_course(user, course_id, payload, request)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_course(
    request: Request,
    course_id: int = Path(..., ge=1, description="Course ID"),
    service: CourseService = Depends(deps.get_course_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Delete a course (soft delete).

    Rate limit: 10 requests per minute.
    Requires ADMIN or DIRECTOR role.
    Will fail if course has students, schedules, or active enrollments.
    """
    await service.delete_course(user, course_id, request)
    return None
