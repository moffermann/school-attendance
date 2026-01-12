"""Teacher endpoints for PWA."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core import deps
from app.core.auth import AuthUser
from app.db.repositories.teachers import TeacherRepository
from app.db.repositories.attendance import AttendanceRepository
from app.schemas.teachers import (
    TeacherMeResponse,
    TeacherRead,
    TeacherCourseRead,
    TeacherStudentRead,
    BulkAttendanceRequest,
    BulkAttendanceResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession


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
