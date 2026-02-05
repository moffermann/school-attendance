"""Import models for Alembic autogeneration."""

# Tenant models (public schema)
from app.db.models.absence_request import AbsenceRequest
from app.db.models.associations import student_guardian_table, teacher_course_table
from app.db.models.authorized_pickup import AuthorizedPickup, student_authorized_pickup_table
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.audit_log import AuditLog
from app.db.models.consent import Consent
from app.db.models.course import Course
from app.db.models.device import Device
from app.db.models.enrollment import Enrollment
from app.db.models.guardian import Guardian
from app.db.models.no_show_alert import NoShowAlert
from app.db.models.notification import Notification
from app.db.models.push_subscription import PushSubscription
from app.db.models.schedule import Schedule
from app.db.models.schedule_exception import ScheduleException
from app.db.models.sequence_correction import SequenceCorrection

# Existing models (tenant schema)
from app.db.models.student import Student
from app.db.models.student_withdrawal import (
    StudentWithdrawal,
    WithdrawalStatus,
    WithdrawalVerificationMethod,
)
from app.db.models.super_admin import SuperAdmin
from app.db.models.tag import Tag
from app.db.models.teacher import Teacher
from app.db.models.tenant import Tenant
from app.db.models.tenant_admin_invitation import TenantAdminInvitation
from app.db.models.tenant_audit_log import TenantAuditLog
from app.db.models.tenant_config import TenantConfig
from app.db.models.tenant_feature import TenantFeature
from app.db.models.usage_stat import UsageStat
from app.db.models.user import User
from app.db.models.user_invitation import UserInvitation
from app.db.models.webauthn_credential import WebAuthnCredential

__all__ = [
    # Multi-tenant models
    "Tenant",
    "SuperAdmin",
    "TenantFeature",
    "TenantConfig",
    "TenantAdminInvitation",
    "UsageStat",
    "TenantAuditLog",
    # Existing models
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
    "Teacher",
    "student_guardian_table",
    "teacher_course_table",
    "student_authorized_pickup_table",
    "AuthorizedPickup",
    "StudentWithdrawal",
    "WithdrawalStatus",
    "WithdrawalVerificationMethod",
    "NoShowAlert",
    "WebAuthnCredential",
    "PushSubscription",
    "UserInvitation",
    "SequenceCorrection",
]
