"""Kiosk device endpoints for provisioning and data sync."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.rate_limiter import limiter
from app.db.repositories.attendance import AttendanceRepository
from app.db.repositories.courses import CourseRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.tags import TagRepository
from app.db.repositories.teachers import TeacherRepository

router = APIRouter()


class KioskStudentRead(BaseModel):
    """Student data for kiosk display."""

    id: int
    full_name: str
    course_id: int | None = None
    course_name: str | None = None  # Denormalized for kiosk display
    photo_url: str | None = None  # Presigned URL for immediate display
    photo_pref_opt_in: bool = False
    # New field: "photo", "audio", or "none"
    evidence_preference: str = "none"
    # Guardian name for display on scan result
    guardian_name: str | None = None


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


class KioskTodayEventRead(BaseModel):
    """Today's attendance event for IN/OUT state tracking."""

    id: int
    student_id: int
    type: str  # 'IN' or 'OUT'
    ts: str  # ISO timestamp


class KioskBootstrapResponse(BaseModel):
    """Bootstrap data for kiosk provisioning."""

    students: list[KioskStudentRead]
    tags: list[KioskTagRead]
    teachers: list[KioskTeacherRead]
    today_events: list[KioskTodayEventRead] = []  # Today's events for IN/OUT state


@router.get("/bootstrap", response_model=KioskBootstrapResponse)
@limiter.limit("10/minute")
async def get_kiosk_bootstrap(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> KioskBootstrapResponse:
    """
    Get all data needed for kiosk provisioning.

    Requires device API key authentication via X-Device-Key header.
    Returns students, tags, teachers and today's events for local caching.
    """
    # Log access for audit
    logger.info(
        "Kiosk bootstrap accessed from %s",
        request.client.host if request.client else "unknown",
    )

    if not device_authenticated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device key inválida")

    student_repo = StudentRepository(session)
    tag_repo = TagRepository(session)
    teacher_repo = TeacherRepository(session)
    attendance_repo = AttendanceRepository(session)
    course_repo = CourseRepository(session)

    # Get all students with guardians for kiosk display
    students_raw = await student_repo.list_all(include_guardians=True)

    # Get all courses for course_name lookup
    courses_raw = await course_repo.list_all()
    course_lookup = {c.id: c.name for c in courses_raw}

    # Build photo proxy URLs for students with photos
    # Uses /api/v1/photos/{key} endpoint which proxies through the API server
    # This allows kiosk devices to access photos through the tunnel
    # IMPORTANT: Use relative URLs so they work regardless of how user accesses the server
    # (localhost, ngrok, production domain, etc.)

    students = []
    for s in students_raw:
        photo_url = None
        if s.photo_url:
            # Use relative URL - works regardless of access method (ngrok, localhost, etc.)
            photo_url = f"/api/v1/photos/{s.photo_url}"

        # Get first guardian name for display
        guardian_name = None
        if s.guardians:
            guardian_name = s.guardians[0].full_name

        # Get course name from lookup
        course_name = course_lookup.get(s.course_id) if s.course_id else None

        students.append(
            KioskStudentRead(
                id=s.id,
                full_name=s.full_name,
                course_id=s.course_id,
                course_name=course_name,
                photo_url=photo_url,
                photo_pref_opt_in=s.photo_pref_opt_in,
                evidence_preference=getattr(s, "effective_evidence_preference", "none"),
                guardian_name=guardian_name,
            )
        )

    # Get all tags - map DB fields to kiosk format
    # DB uses tag_token_preview, kiosk uses token
    # teacher_id is not yet in Tag model, will be None
    tags_raw = await tag_repo.list_all()
    tags = [
        KioskTagRead(
            token=t.tag_token_preview,
            student_id=t.student_id,
            teacher_id=getattr(t, "teacher_id", None),  # Future-proof
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

    # Get today's events for IN/OUT state tracking
    today = date.today()
    today_events_raw = await attendance_repo.list_by_date(today)
    today_events = [
        KioskTodayEventRead(
            id=e.id,
            student_id=e.student_id,
            type=e.type,
            ts=e.occurred_at.isoformat() if e.occurred_at else "",
        )
        for e in today_events_raw
    ]

    return KioskBootstrapResponse(
        students=students,
        tags=tags,
        teachers=teachers,
        today_events=today_events,
    )


@router.get("/students", response_model=list[KioskStudentRead])
@limiter.limit("20/minute")
async def get_kiosk_students(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskStudentRead]:
    """Get all students for kiosk with photo proxy URLs."""
    if not device_authenticated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device key inválida")

    student_repo = StudentRepository(session)
    course_repo = CourseRepository(session)
    students_raw = await student_repo.list_all(include_guardians=True)

    # Get all courses for course_name lookup
    courses_raw = await course_repo.list_all()
    course_lookup = {c.id: c.name for c in courses_raw}

    # Build photo proxy URLs using relative URLs (works with ngrok, localhost, etc.)
    students = []
    for s in students_raw:
        photo_url = None
        if s.photo_url:
            # Use relative URL - works regardless of access method
            photo_url = f"/api/v1/photos/{s.photo_url}"

        # Get first guardian name for display
        guardian_name = None
        if s.guardians:
            guardian_name = s.guardians[0].full_name

        # Get course name from lookup
        course_name = course_lookup.get(s.course_id) if s.course_id else None

        students.append(
            KioskStudentRead(
                id=s.id,
                full_name=s.full_name,
                course_id=s.course_id,
                course_name=course_name,
                photo_url=photo_url,
                photo_pref_opt_in=s.photo_pref_opt_in,
                evidence_preference=getattr(s, "effective_evidence_preference", "none"),
                guardian_name=guardian_name,
            )
        )

    return students


@router.get("/tags", response_model=list[KioskTagRead])
@limiter.limit("20/minute")
async def get_kiosk_tags(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskTagRead]:
    """Get all tags for kiosk."""
    if not device_authenticated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device key inválida")

    tag_repo = TagRepository(session)
    tags_raw = await tag_repo.list_all()

    return [
        KioskTagRead(
            token=t.tag_token_preview,
            student_id=t.student_id,
            teacher_id=getattr(t, "teacher_id", None),
            status=t.status,
        )
        for t in tags_raw
    ]


@router.get("/teachers", response_model=list[KioskTeacherRead])
@limiter.limit("20/minute")
async def get_kiosk_teachers(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskTeacherRead]:
    """Get all teachers for kiosk admin access."""
    if not device_authenticated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device key inválida")

    teacher_repo = TeacherRepository(session)
    teachers_raw = await teacher_repo.list_all()

    return [
        KioskTeacherRead(
            id=t.id,
            full_name=t.full_name,
        )
        for t in teachers_raw
    ]


@router.get("/today-events", response_model=list[KioskTodayEventRead])
@limiter.limit("30/minute")
async def get_kiosk_today_events(
    request: Request,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[KioskTodayEventRead]:
    """Get today's attendance events for IN/OUT state tracking.

    Called after cache clear to restore proper IN/OUT alternation.
    """
    if not device_authenticated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device key inválida")

    attendance_repo = AttendanceRepository(session)
    today = date.today()
    events_raw = await attendance_repo.list_by_date(today)

    return [
        KioskTodayEventRead(
            id=e.id,
            student_id=e.student_id,
            type=e.type,
            ts=e.occurred_at.isoformat() if e.occurred_at else "",
        )
        for e in events_raw
    ]
