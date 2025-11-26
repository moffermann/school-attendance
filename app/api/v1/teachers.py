"""Teacher endpoints for PWA."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

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


def get_teacher_repo(session: AsyncSession = Depends(deps.get_db)) -> TeacherRepository:
    return TeacherRepository(session)


def get_attendance_repo(session: AsyncSession = Depends(deps.get_db)) -> AttendanceRepository:
    return AttendanceRepository(session)


@router.get("/me", response_model=TeacherMeResponse)
async def get_current_teacher(
    user: AuthUser = Depends(deps.get_current_user),
    repo: TeacherRepository = Depends(get_teacher_repo),
) -> TeacherMeResponse:
    """Get current teacher's information and assigned courses.

    Requires TEACHER role with a valid teacher_id.
    """
    if user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo profesores pueden acceder a este recurso",
        )

    if not user.teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene perfil de profesor asociado",
        )

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


@router.get("/courses/{course_id}/students", response_model=list[TeacherStudentRead])
async def list_course_students(
    course_id: int,
    user: AuthUser = Depends(deps.get_current_user),
    repo: TeacherRepository = Depends(get_teacher_repo),
) -> list[TeacherStudentRead]:
    """List students in a course assigned to the current teacher.

    Returns 403 if teacher is not assigned to the course.
    """
    if user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo profesores pueden acceder a este recurso",
        )

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
    session: AsyncSession = Depends(deps.get_db),
) -> BulkAttendanceResponse:
    """Submit multiple attendance events at once.

    Used by teacher PWA to sync offline attendance records.
    """
    if user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo profesores pueden acceder a este recurso",
        )

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
            )
            processed += 1
        except Exception as e:
            errors.append(f"student_id={item.student_id}: {str(e)}")

    await session.commit()

    return BulkAttendanceResponse(processed=processed, errors=errors)
