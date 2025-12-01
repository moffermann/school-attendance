"""Kiosk device endpoints for provisioning and data sync."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel

from app.core import deps
from app.core.rate_limiter import limiter
from app.db.repositories.students import StudentRepository
from app.db.repositories.tags import TagRepository
from app.db.repositories.teachers import TeacherRepository
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()


class KioskStudentRead(BaseModel):
    """Student data for kiosk display."""
    id: int
    full_name: str
    course_id: int | None = None
    photo_ref: str | None = None
    photo_pref_opt_in: bool = False


class KioskTagRead(BaseModel):
    """Tag data for kiosk validation.

    Note: The kiosk uses 'token' field which maps to tag_token_preview in DB.
    Teacher tags are identified by having teacher_id set (requires DB migration).
    For now, all tags are student tags.
    """
    token: str
    student_id: int | None = None
    teacher_id: int | None = None
    status: str


class KioskTeacherRead(BaseModel):
    """Teacher data for kiosk admin access."""
    id: int
    full_name: str


class KioskBootstrapResponse(BaseModel):
    """Bootstrap data for kiosk provisioning."""
    students: list[KioskStudentRead]
    tags: list[KioskTagRead]
    teachers: list[KioskTeacherRead]


@router.get("/bootstrap", response_model=KioskBootstrapResponse)
@limiter.limit("10/minute")
async def get_kiosk_bootstrap(
    request: Request,
    session: AsyncSession = Depends(deps.get_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> KioskBootstrapResponse:
    """
    Get all data needed for kiosk provisioning.

    Requires device API key authentication via X-Device-Key header.
    Returns students, tags, and teachers for local caching.
    """
    # Log access for audit
    logger.info(
        "Kiosk bootstrap accessed from %s",
        request.client.host if request.client else "unknown",
    )

    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    student_repo = StudentRepository(session)
    tag_repo = TagRepository(session)
    teacher_repo = TeacherRepository(session)

    # Get all students
    students_raw = await student_repo.list_all()
    students = [
        KioskStudentRead(
            id=s.id,
            full_name=s.full_name,
            course_id=s.course_id,
            photo_ref=s.photo_ref,
            photo_pref_opt_in=s.photo_pref_opt_in,
        )
        for s in students_raw
    ]

    # Get all tags - map DB fields to kiosk format
    # DB uses tag_token_preview, kiosk uses token
    # teacher_id is not yet in Tag model, will be None
    tags_raw = await tag_repo.list_all()
    tags = [
        KioskTagRead(
            token=t.tag_token_preview,
            student_id=t.student_id,
            teacher_id=getattr(t, 'teacher_id', None),  # Future-proof
            status=t.status,
        )
        for t in tags_raw
    ]

    # Get all teachers
    teachers_raw = await teacher_repo.list_all()
    teachers = [
        KioskTeacherRead(
            id=t.id,
            full_name=t.full_name,
        )
        for t in teachers_raw
    ]

    return KioskBootstrapResponse(
        students=students,
        tags=tags,
        teachers=teachers,
    )


@router.get("/students", response_model=list[KioskStudentRead])
@limiter.limit("20/minute")
async def get_kiosk_students(
    request: Request,
    session: AsyncSession = Depends(deps.get_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskStudentRead]:
    """Get all students for kiosk."""
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    student_repo = StudentRepository(session)
    students_raw = await student_repo.list_all()

    return [
        KioskStudentRead(
            id=s.id,
            full_name=s.full_name,
            course_id=s.course_id,
            photo_ref=s.photo_ref,
            photo_pref_opt_in=s.photo_pref_opt_in,
        )
        for s in students_raw
    ]


@router.get("/tags", response_model=list[KioskTagRead])
@limiter.limit("20/minute")
async def get_kiosk_tags(
    request: Request,
    session: AsyncSession = Depends(deps.get_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskTagRead]:
    """Get all tags for kiosk."""
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    tag_repo = TagRepository(session)
    tags_raw = await tag_repo.list_all()

    return [
        KioskTagRead(
            token=t.tag_token_preview,
            student_id=t.student_id,
            teacher_id=getattr(t, 'teacher_id', None),
            status=t.status,
        )
        for t in tags_raw
    ]


@router.get("/teachers", response_model=list[KioskTeacherRead])
@limiter.limit("20/minute")
async def get_kiosk_teachers(
    request: Request,
    session: AsyncSession = Depends(deps.get_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskTeacherRead]:
    """Get all teachers for kiosk admin access."""
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    teacher_repo = TeacherRepository(session)
    teachers_raw = await teacher_repo.list_all()

    return [
        KioskTeacherRead(
            id=t.id,
            full_name=t.full_name,
        )
        for t in teachers_raw
    ]
