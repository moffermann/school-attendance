"""Schemas for the web-app integration payloads."""

from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.auth import SessionUser


class StudentSummary(BaseModel):
    id: int
    full_name: str
    course_id: int
    course_name: str | None = None  # Denormalized for kiosk display
    photo_pref_opt_in: bool = False


# R8-V4 fix: Define valid contact types
class ContactType(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    PHONE = "phone"


class GuardianContact(BaseModel):
    # R8-V4 fix: Use enum for contact type
    type: ContactType
    value: str
    verified: bool = True


class GuardianSummary(BaseModel):
    id: int
    full_name: str
    contacts: list[GuardianContact] = Field(default_factory=list)
    student_ids: list[int] = Field(default_factory=list)


class CourseSummary(BaseModel):
    id: int
    name: str
    grade: str
    status: str = "ACTIVE"
    teacher_ids: list[int] = Field(default_factory=list)


class ScheduleSummary(BaseModel):
    id: int
    course_id: int
    weekday: int
    in_time: str
    out_time: str


class ScheduleExceptionSummary(BaseModel):
    id: int
    scope: str
    course_id: int | None = None
    date: date
    in_time: str | None = None
    out_time: str | None = None
    reason: str


class AttendanceEventSummary(BaseModel):
    id: int
    student_id: int
    # R8-V6 fix: Use Literal for attendance type
    type: Literal["IN", "OUT"]
    gate_id: str
    ts: str
    device_id: str
    photo_ref: str | None = None
    source: str | None = None


class DeviceSummary(BaseModel):
    id: int
    gate_id: str
    device_id: str
    version: str
    last_sync: str | None = None
    pending_count: int = Field(..., ge=0)
    # R8-V7 fix: Validate battery percentage range
    battery_pct: int = Field(..., ge=0, le=100)
    status: str


class AbsenceSummary(BaseModel):
    id: int
    student_id: int
    type: str
    start: date
    end: date
    comment: str | None = None
    attachment_name: str | None = None
    status: str


class NotificationSummary(BaseModel):
    id: int
    guardian_id: int
    student_id: int | None = None
    type: str
    channel: str
    sent_at: str | None = None
    status: str
    template: str | None = None  # e.g., INGRESO_OK, SALIDA_OK
    payload: dict | None = None  # Contains student_name, time, date, etc.


class TeacherSummary(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    course_ids: list[int] = Field(default_factory=list)


class DashboardEvent(BaseModel):
    id: int
    student_id: int
    student_name: str
    course_id: int
    course_name: str
    type: str
    gate_id: str
    ts: str | None = None
    device_id: str
    photo_ref: str | None = None
    photo_url: str | None = None
    source: str | None = None


class DashboardStats(BaseModel):
    total_in: int
    total_out: int
    late_count: int
    no_in_count: int
    with_photos: int


class DashboardSnapshot(BaseModel):
    date: date
    stats: DashboardStats
    events: list[DashboardEvent] = Field(default_factory=list)


class ReportCourseSummary(BaseModel):
    course_id: int
    course_name: str
    total_students: int
    present: int
    late: int
    absent: int
    attendance_pct: float


class ReportTrendPoint(BaseModel):
    date: date
    present: int


class ReportsSnapshot(BaseModel):
    start_date: date
    end_date: date
    courses: list[ReportCourseSummary] = Field(default_factory=list)
    trend: list[ReportTrendPoint] = Field(default_factory=list)


class WebAppBootstrap(BaseModel):
    current_user: SessionUser
    students: list[StudentSummary] = Field(default_factory=list)
    guardians: list[GuardianSummary] = Field(default_factory=list)
    courses: list[CourseSummary] = Field(default_factory=list)
    schedules: list[ScheduleSummary] = Field(default_factory=list)
    schedule_exceptions: list[ScheduleExceptionSummary] = Field(default_factory=list)
    attendance_events: list[AttendanceEventSummary] = Field(default_factory=list)
    devices: list[DeviceSummary] = Field(default_factory=list)
    absences: list[AbsenceSummary] = Field(default_factory=list)
    notifications: list[NotificationSummary] = Field(default_factory=list)
    teachers: list[TeacherSummary] = Field(default_factory=list)
