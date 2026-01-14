"""Teacher endpoints for PWA and admin CRUD."""

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.db.repositories.teachers import TeacherRepository
from app.db.repositories.attendance import AttendanceRepository
from app.schemas.teachers import (
    BulkAttendanceRequest,
    BulkAttendanceResponse,
    TeacherCourseRead,
    TeacherCreate,
    TeacherListResponse,
    TeacherMeResponse,
    TeacherRead,
    TeacherStudentRead,
    TeacherUpdate,
)


router = APIRouter()

# Roles that can access teacher endpoints
# Directors, inspectors, admins often teach classes in small schools
TEACHER_PORTAL_ROLES = ("TEACHER", "DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN")


def get_teacher_repo(session: AsyncSession = Depends(deps.get_tenant_db)) -> TeacherRepository:
    return TeacherRepository(session)


def get_attendance_repo(session: AsyncSession = Depends(deps.get_tenant_db)) -> AttendanceRepository:
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
        user.role in ("DIRECTOR", "INSPECTOR", "ADMIN", "SUPER_ADMIN")
        and not user.teacher_id
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
                datetime.fromisoformat(item.occurred_at)
                if item.occurred_at
                else datetime.now(timezone.utc)
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


def _teacher_to_response(teacher) -> TeacherRead:
    """Convert a Teacher model to response schema."""
    return TeacherRead(
        id=teacher.id,
        full_name=teacher.full_name,
        email=teacher.email,
        status=teacher.status,
        can_enroll_biometric=teacher.can_enroll_biometric,
    )


@router.get("", response_model=TeacherListResponse)
async def list_teachers(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Registros por página"),
    q: str | None = Query(None, min_length=2, description="Buscar por nombre o email"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TeacherListResponse:
    """List teachers with pagination and search.

    - **page**: Page number (1-indexed)
    - **page_size**: Records per page (max 100)
    - **q**: Search by name or email (case-insensitive, min 2 chars)
    """
    repo = TeacherRepository(session)
    teachers, total = await repo.list_paginated(
        page=page,
        page_size=page_size,
        search=q,
    )

    items = [_teacher_to_response(t) for t in teachers]
    pages = math.ceil(total / page_size) if total > 0 else 1

    return TeacherListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post("", response_model=TeacherRead, status_code=status.HTTP_201_CREATED)
async def create_teacher(
    payload: TeacherCreate,
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> TeacherRead:
    """Create a new teacher.

    - **full_name**: Teacher's full name (required, 2-255 chars)
    - **email**: Email address (optional, must be unique)
    - **status**: ACTIVE, INACTIVE, or ON_LEAVE (default: ACTIVE)
    - **can_enroll_biometric**: Whether teacher can enroll biometric (default: false)
    """
    repo = TeacherRepository(session)

    # Check email uniqueness if provided
    if payload.email:
        existing = await repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un profesor con este email"
            )

    teacher = await repo.create(
        full_name=payload.full_name,
        email=payload.email,
    )

    # Update additional fields
    if payload.status != "ACTIVE" or payload.can_enroll_biometric:
        teacher = await repo.update(
            teacher.id,
            status=payload.status,
            can_enroll_biometric=payload.can_enroll_biometric,
        )

    await session.commit()

    logger.info(f"Created teacher {teacher.id}: {teacher.full_name}")

    return _teacher_to_response(teacher)


@router.get("/{teacher_id}", response_model=TeacherRead)
async def get_teacher(
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TeacherRead:
    """Get a teacher by ID."""
    repo = TeacherRepository(session)
    teacher = await repo.get(teacher_id)

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor no encontrado"
        )

    return _teacher_to_response(teacher)


@router.patch("/{teacher_id}", response_model=TeacherRead)
async def update_teacher(
    payload: TeacherUpdate,
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> TeacherRead:
    """Update a teacher's information."""
    repo = TeacherRepository(session)
    teacher = await repo.get(teacher_id)

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor no encontrado"
        )

    # Check email uniqueness if changing
    if payload.email is not None and payload.email != teacher.email:
        existing = await repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un profesor con este email"
            )

    # Build update kwargs
    update_kwargs = {}
    if payload.full_name is not None:
        update_kwargs["full_name"] = payload.full_name
    if payload.email is not None:
        update_kwargs["email"] = payload.email
    if payload.status is not None:
        update_kwargs["status"] = payload.status
    if payload.can_enroll_biometric is not None:
        update_kwargs["can_enroll_biometric"] = payload.can_enroll_biometric

    if update_kwargs:
        teacher = await repo.update(teacher_id, **update_kwargs)

    await session.commit()

    return _teacher_to_response(teacher)


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_teacher(
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Delete a teacher.

    This will also remove all course assignments.
    """
    repo = TeacherRepository(session)
    teacher = await repo.get(teacher_id)

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor no encontrado"
        )

    deleted = await repo.delete(teacher_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar profesor"
        )

    await session.commit()

    logger.info(f"Deleted teacher {teacher_id}: {teacher.full_name}")


@router.post("/{teacher_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def assign_course_to_teacher(
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    course_id: int = Path(..., ge=1, description="ID del curso"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Assign a course to a teacher."""
    repo = TeacherRepository(session)

    success = await repo.assign_course(teacher_id, course_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor o curso no encontrado"
        )

    await session.commit()


@router.delete("/{teacher_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_course_from_teacher(
    teacher_id: int = Path(..., ge=1, description="ID del profesor"),
    course_id: int = Path(..., ge=1, description="ID del curso"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Remove a course assignment from a teacher."""
    repo = TeacherRepository(session)

    success = await repo.unassign_course(teacher_id, course_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor o curso no encontrado"
        )

    await session.commit()
