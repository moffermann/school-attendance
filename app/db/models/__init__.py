"""Import models for Alembic autogeneration."""

from app.db.models.student import Student
from app.db.models.guardian import Guardian
from app.db.models.course import Course
from app.db.models.enrollment import Enrollment
from app.db.models.device import Device
from app.db.models.tag import Tag
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.absence_request import AbsenceRequest
from app.db.models.notification import Notification
from app.db.models.consent import Consent
from app.db.models.schedule import Schedule
from app.db.models.schedule_exception import ScheduleException
from app.db.models.audit_log import AuditLog
from app.db.models.user import User
from app.db.models.associations import student_guardian_table
from app.db.models.no_show_alert import NoShowAlert

__all__ = [
    "Student",
    "Guardian",
    "Course",
    "Enrollment",
    "Device",
    "Tag",
    "AttendanceEvent",
    "AbsenceRequest",
    "Notification",
    "Consent",
    "Schedule",
    "ScheduleException",
    "AuditLog",
    "User",
    "student_guardian_table",
    "NoShowAlert",
]
