"""Service layer for the SPA integration."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import AuthUser
from app.db.models.absence_request import AbsenceRequest
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.course import Course
from app.db.models.device import Device
from app.db.models.guardian import Guardian
from app.db.models.notification import Notification
from app.db.models.schedule import Schedule
from app.db.models.schedule_exception import ScheduleException
from app.db.models.student import Student
from app.db.models.authorized_pickup import AuthorizedPickup
from app.db.models.authorized_pickup import student_authorized_pickup_table
from app.db.models.student_withdrawal import StudentWithdrawal
from app.db.models.teacher import Teacher
from app.db.models.withdrawal_request import WithdrawalRequest
from app.schemas.auth import SessionUser
from app.schemas.webapp import (
    AbsenceSummary,
    AttendanceEventSummary,
    CourseSummary,
    DeviceSummary,
    GuardianContact,
    GuardianSummary,
    NotificationSummary,
    ScheduleExceptionSummary,
    ScheduleSummary,
    StudentSummary,
    TeacherSummary,
    AuthorizedPickupSummary,
    WebAppBootstrap,
    WithdrawalRequestSummary,
    WithdrawalSummary,
)

STAFF_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}


class WebAppDataService:
    """Aggregates data required by the HTML SPA."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def build_bootstrap_payload(self, user: AuthUser) -> WebAppBootstrap:
        is_staff = user.role in STAFF_ROLES

        guardian: Guardian | None = None
        if not is_staff:
            if not user.guardian_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="El usuario no tiene apoderado asociado",
                )

            guardian_stmt = (
                select(Guardian)
                .where(Guardian.id == user.guardian_id)
                .options(selectinload(Guardian.students))
            )
            guardian = (await self.session.execute(guardian_stmt)).scalar_one_or_none()
            if guardian is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Apoderado no encontrado"
                )

        student_ids = await self._resolve_student_ids(is_staff, guardian)
        students = await self._load_students(student_ids)
        course_ids = {student.course_id for student in students}

        courses = await self._load_courses(course_ids, is_staff)
        schedules = await self._load_schedules(course_ids, is_staff)
        schedule_exceptions = await self._load_schedule_exceptions(course_ids, is_staff)
        guardians = await self._load_guardians(is_staff, guardian)
        attendance_events = await self._load_attendance_events(student_ids, is_staff)
        devices = await self._load_devices(is_staff)
        absences = await self._load_absences(student_ids, is_staff)
        notifications = await self._load_notifications(student_ids, guardians, is_staff)
        teachers = await self._load_teachers(is_staff)
        withdrawals = await self._load_withdrawals(student_ids)
        authorized_pickups = await self._load_authorized_pickups(student_ids)
        withdrawal_requests = await self._load_withdrawal_requests(
            guardian.id if guardian else None, student_ids, is_staff
        )

        # Build course lookup for denormalized course_name in StudentSummary
        course_lookup = {course.id: course.name for course in courses}

        session_user = SessionUser(
            id=user.id,
            full_name=user.full_name,
            role=user.role,
            guardian_id=user.guardian_id,
        )

        return WebAppBootstrap(
            current_user=session_user,
            students=[self._map_student(student, course_lookup) for student in students],
            guardians=[self._map_guardian(g) for g in guardians],
            courses=[self._map_course(course) for course in courses],
            schedules=[self._map_schedule(schedule) for schedule in schedules],
            schedule_exceptions=[self._map_schedule_exception(exc) for exc in schedule_exceptions],
            attendance_events=[self._map_attendance_event(event) for event in attendance_events],
            devices=[self._map_device(device) for device in devices],
            absences=[self._map_absence(absence) for absence in absences],
            notifications=[self._map_notification(notification) for notification in notifications],
            teachers=[self._map_teacher(teacher) for teacher in teachers],
            withdrawals=[self._map_withdrawal(w) for w in withdrawals],
            authorized_pickups=[self._map_authorized_pickup(p) for p in authorized_pickups],
            withdrawal_requests=[self._map_withdrawal_request(r) for r in withdrawal_requests],
        )

    async def _resolve_student_ids(self, is_staff: bool, guardian: Guardian | None) -> list[int]:
        if is_staff:
            stmt = select(Student.id)
            result = await self.session.execute(stmt)
            return [row[0] for row in result.all()]

        assert guardian is not None  # validated beforehand
        return [student.id for student in guardian.students]

    async def _load_students(self, student_ids: list[int]) -> list[Student]:
        if not student_ids:
            return []
        stmt = (
            select(Student)
            .where(Student.id.in_(student_ids))
            .options(selectinload(Student.guardians))
            .order_by(Student.full_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_guardians(self, is_staff: bool, guardian: Guardian | None) -> list[Guardian]:
        if is_staff:
            stmt = (
                select(Guardian)
                .options(selectinload(Guardian.students))
                .order_by(Guardian.full_name)
            )
            result = await self.session.execute(stmt)
            return list(result.scalars().all())
        if guardian is None:
            return []
        return [guardian]

    async def _load_courses(self, course_ids: set[int], is_staff: bool) -> list[Course]:
        stmt = select(Course).options(selectinload(Course.teachers)).order_by(Course.name)
        if not is_staff and course_ids:
            stmt = stmt.where(Course.id.in_(course_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_schedules(self, course_ids: set[int], is_staff: bool) -> list[Schedule]:
        stmt = select(Schedule).order_by(Schedule.course_id, Schedule.weekday)
        # Staff users see all schedules; non-staff only see schedules for their courses
        if not is_staff:
            if not course_ids:
                return []
            stmt = stmt.where(Schedule.course_id.in_(course_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_schedule_exceptions(
        self, course_ids: set[int], is_staff: bool
    ) -> list[ScheduleException]:
        stmt = select(ScheduleException).order_by(ScheduleException.date.desc())
        if not is_staff:
            stmt = stmt.where(
                (ScheduleException.scope == "GLOBAL")
                | (
                    ScheduleException.course_id.is_not(None)
                    & ScheduleException.course_id.in_(course_ids)
                )
            )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_attendance_events(
        self, student_ids: list[int], is_staff: bool
    ) -> list[AttendanceEvent]:
        if not student_ids:
            return []
        stmt = (
            select(AttendanceEvent)
            .where(AttendanceEvent.student_id.in_(student_ids))
            .order_by(AttendanceEvent.occurred_at.desc())
            .limit(500 if is_staff else 200)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_devices(self, is_staff: bool) -> list[Device]:
        if not is_staff:
            return []
        result = await self.session.execute(select(Device).order_by(Device.gate_id))
        return list(result.scalars().all())

    async def _load_teachers(self, is_staff: bool) -> list[Teacher]:
        if not is_staff:
            return []
        stmt = select(Teacher).options(selectinload(Teacher.courses)).order_by(Teacher.full_name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_absences(self, student_ids: list[int], is_staff: bool) -> list[AbsenceRequest]:
        if not student_ids:
            return []
        stmt = (
            select(AbsenceRequest)
            .where(AbsenceRequest.student_id.in_(student_ids))
            .order_by(AbsenceRequest.ts_submitted.desc())
        )
        if is_staff:
            stmt = select(AbsenceRequest).order_by(AbsenceRequest.ts_submitted.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _load_notifications(
        self,
        student_ids: list[int],
        guardians: list[Guardian],
        is_staff: bool,
    ) -> list[Notification]:
        if not guardians:
            return []

        guardian_ids = [g.id for g in guardians]
        stmt = (
            select(Notification)
            .where(Notification.guardian_id.in_(guardian_ids))
            .order_by(Notification.ts_created.desc())
        )
        if is_staff:
            result = await self.session.execute(stmt.limit(300))
            return list(result.scalars().all())

        # For parents, restrict to notifications tied to their students
        stmt = stmt.where(Notification.payload["student_id"].as_integer().in_(student_ids))
        result = await self.session.execute(stmt.limit(200))
        return list(result.scalars().all())

    @staticmethod
    def _format_time(value: datetime | None) -> str | None:
        if not value:
            return None
        return value.replace(microsecond=0).isoformat()

    @staticmethod
    def _map_student(
        student: Student, course_lookup: dict[int, str] | None = None
    ) -> StudentSummary:
        course_name = None
        if course_lookup and student.course_id in course_lookup:
            course_name = course_lookup[student.course_id]
        return StudentSummary(
            id=student.id,
            full_name=student.full_name,
            course_id=student.course_id,
            course_name=course_name,
            photo_pref_opt_in=bool(student.photo_pref_opt_in),
        )

    @staticmethod
    def _map_guardian(guardian: Guardian) -> GuardianSummary:
        contacts = []
        for key, value in (guardian.contacts or {}).items():
            if value:
                contacts.append(GuardianContact(type=key, value=value, verified=True))
        return GuardianSummary(
            id=guardian.id,
            full_name=guardian.full_name,
            contacts=contacts,
            student_ids=[student.id for student in guardian.students],
        )

    @staticmethod
    def _map_course(course: Course) -> CourseSummary:
        """Map Course model to CourseSummary schema."""
        return CourseSummary(
            id=course.id,
            name=course.name,
            grade=course.grade,
            status=course.status,
            teacher_ids=[teacher.id for teacher in course.teachers] if course.teachers else [],
        )

    @staticmethod
    def _map_schedule(schedule: Schedule) -> ScheduleSummary:
        return ScheduleSummary(
            id=schedule.id,
            course_id=schedule.course_id,
            weekday=schedule.weekday,
            in_time=schedule.in_time.strftime("%H:%M"),
            out_time=schedule.out_time.strftime("%H:%M"),
        )

    @staticmethod
    def _map_schedule_exception(exc: ScheduleException) -> ScheduleExceptionSummary:
        return ScheduleExceptionSummary(
            id=exc.id,
            scope=exc.scope,
            course_id=exc.course_id,
            date=exc.date,
            in_time=exc.in_time.strftime("%H:%M") if exc.in_time else None,
            out_time=exc.out_time.strftime("%H:%M") if exc.out_time else None,
            reason=exc.reason,
        )

    def _map_attendance_event(self, event: AttendanceEvent) -> AttendanceEventSummary:
        return AttendanceEventSummary(
            id=event.id,
            student_id=event.student_id,
            type=event.type,
            gate_id=event.gate_id,
            # R5-B2 fix: Use timezone-aware datetime
            ts=self._format_time(event.occurred_at) or datetime.now(UTC).isoformat(),
            device_id=event.device_id,
            photo_ref=event.photo_ref,
            source=event.source,
        )

    def _map_device(self, device: Device) -> DeviceSummary:
        return DeviceSummary(
            id=device.id,
            gate_id=device.gate_id,
            device_id=device.device_id,
            version=device.firmware_version,
            last_sync=self._format_time(device.last_sync),
            pending_count=device.pending_events,
            battery_pct=device.battery_pct,
            status="ACTIVE" if device.online else "OFFLINE",
        )

    @staticmethod
    def _map_absence(absence: AbsenceRequest) -> AbsenceSummary:
        return AbsenceSummary(
            id=absence.id,
            student_id=absence.student_id,
            type=absence.type,
            start=absence.start_date,
            end=absence.end_date,
            comment=absence.comment,
            attachment_name=absence.attachment_ref,
            status=absence.status,
        )

    def _map_notification(self, notification: Notification) -> NotificationSummary:
        student_id = notification.payload.get("student_id") if notification.payload else None
        sent_at = notification.ts_sent or notification.ts_created
        return NotificationSummary(
            id=notification.id,
            guardian_id=notification.guardian_id,
            student_id=student_id,
            type=notification.template,
            channel=notification.channel,
            sent_at=self._format_time(sent_at),
            status=notification.status,
            template=notification.template,  # e.g., INGRESO_OK, SALIDA_OK
            payload=notification.payload,  # Full payload with student_name, time, etc.
        )

    async def _load_authorized_pickups(
        self, student_ids: list[int]
    ) -> list[AuthorizedPickup]:
        """Load authorized pickups linked to the given students."""
        if not student_ids:
            return []
        # Get pickup IDs linked to these students
        assoc_stmt = (
            select(student_authorized_pickup_table.c.authorized_pickup_id)
            .where(student_authorized_pickup_table.c.student_id.in_(student_ids))
            .distinct()
        )
        assoc_result = await self.session.execute(assoc_stmt)
        pickup_ids = [row[0] for row in assoc_result.all()]
        if not pickup_ids:
            return []

        stmt = (
            select(AuthorizedPickup)
            .where(AuthorizedPickup.id.in_(pickup_ids))
            .options(selectinload(AuthorizedPickup.students))
            .order_by(AuthorizedPickup.full_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def _build_photo_proxy_url(photo_key: str | None) -> str | None:
        """Build a proxy URL for accessing photos through the API."""
        if not photo_key:
            return None
        return f"/api/v1/photos/{photo_key}"

    @staticmethod
    def _map_authorized_pickup(p: AuthorizedPickup) -> AuthorizedPickupSummary:
        photo_url = f"/api/v1/photos/{p.photo_url}" if p.photo_url else None
        return AuthorizedPickupSummary(
            id=p.id,
            full_name=p.full_name,
            relationship_type=p.relationship_type,
            national_id=p.national_id,
            phone=p.phone,
            email=p.email,
            photo_url=photo_url,
            is_active=p.is_active,
            student_ids=[s.id for s in p.students] if p.students else [],
            has_photo=bool(p.photo_url),
            has_qr=bool(p.qr_code_hash),
        )

    async def _load_withdrawals(self, student_ids: list[int]) -> list[StudentWithdrawal]:
        """Load completed withdrawals for the last 90 days."""
        if not student_ids:
            return []
        cutoff = datetime.now(UTC) - timedelta(days=90)
        stmt = (
            select(StudentWithdrawal)
            .where(
                StudentWithdrawal.student_id.in_(student_ids),
                StudentWithdrawal.initiated_at >= cutoff,
            )
            .options(selectinload(StudentWithdrawal.authorized_pickup))
            .order_by(StudentWithdrawal.initiated_at.desc())
            .limit(200)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    def _map_withdrawal(self, w: StudentWithdrawal) -> WithdrawalSummary:
        pickup = w.authorized_pickup
        return WithdrawalSummary(
            id=w.id,
            student_id=w.student_id,
            status=w.status,
            authorized_pickup_id=w.authorized_pickup_id,
            pickup_name=pickup.full_name if pickup else None,
            pickup_relationship=pickup.relationship_type if pickup else None,
            initiated_at=self._format_time(w.initiated_at),
            completed_at=self._format_time(w.completed_at),
            reason=w.reason,
        )

    async def _load_withdrawal_requests(
        self,
        guardian_id: int | None,
        student_ids: list[int],
        is_staff: bool,
    ) -> list[WithdrawalRequest]:
        """Load withdrawal requests for bootstrap.

        Staff: all recent requests (last 30 days + any PENDING/APPROVED).
        Parent: only their own requests.
        """
        from sqlalchemy import or_

        if is_staff:
            cutoff = datetime.now(UTC) - timedelta(days=30)
            stmt = (
                select(WithdrawalRequest)
                .where(
                    or_(
                        WithdrawalRequest.scheduled_date >= cutoff.date(),
                        WithdrawalRequest.status.in_(["PENDING", "APPROVED"]),
                    )
                )
                .options(
                    selectinload(WithdrawalRequest.student),
                    selectinload(WithdrawalRequest.authorized_pickup),
                )
                .order_by(WithdrawalRequest.created_at.desc())
                .limit(200)
            )
        elif guardian_id:
            stmt = (
                select(WithdrawalRequest)
                .where(WithdrawalRequest.requested_by_guardian_id == guardian_id)
                .options(
                    selectinload(WithdrawalRequest.student),
                    selectinload(WithdrawalRequest.authorized_pickup),
                )
                .order_by(WithdrawalRequest.created_at.desc())
                .limit(100)
            )
        else:
            return []

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    def _map_withdrawal_request(self, r: WithdrawalRequest) -> WithdrawalRequestSummary:
        pickup = r.authorized_pickup
        student = r.student
        return WithdrawalRequestSummary(
            id=r.id,
            student_id=r.student_id,
            authorized_pickup_id=r.authorized_pickup_id,
            status=r.status,
            scheduled_date=r.scheduled_date,
            scheduled_time=str(r.scheduled_time) if r.scheduled_time else None,
            reason=r.reason,
            pickup_name=pickup.full_name if pickup else None,
            pickup_relationship=pickup.relationship_type if pickup else None,
            student_name=student.full_name if student else None,
            review_notes=r.review_notes,
            created_at=self._format_time(r.created_at) or "",
        )

    @staticmethod
    def _map_teacher(teacher: Teacher) -> TeacherSummary:
        return TeacherSummary(
            id=teacher.id,
            full_name=teacher.full_name,
            email=teacher.email or "",
            phone=None,
            course_ids=[course.id for course in teacher.courses],
        )
