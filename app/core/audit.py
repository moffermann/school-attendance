"""Audit logging for security-sensitive events."""

import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from loguru import logger


class AuditEvent(StrEnum):
    """Security-sensitive events that should be audited."""

    # Authentication events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILURE = "auth.login.failure"
    LOGOUT = "auth.logout"
    TOKEN_REFRESH = "auth.token.refresh"
    TOKEN_REVOKED = "auth.token.revoked"

    # Authorization events
    ACCESS_DENIED = "authz.access.denied"
    ROLE_CHANGED = "authz.role.changed"

    # Data events
    STUDENT_CREATED = "data.student.created"
    STUDENT_UPDATED = "data.student.updated"
    STUDENT_DELETED = "data.student.deleted"
    STUDENT_EXPORTED = "data.student.exported"
    GUARDIAN_LINKED = "data.guardian.linked"

    # Course events
    COURSE_CREATED = "data.course.created"
    COURSE_UPDATED = "data.course.updated"
    COURSE_DELETED = "data.course.deleted"
    COURSE_VIEWED = "data.course.viewed"
    COURSE_EXPORTED = "data.course.exported"

    # Teacher events
    TEACHER_CREATED = "data.teacher.created"
    TEACHER_UPDATED = "data.teacher.updated"
    TEACHER_DELETED = "data.teacher.deleted"
    TEACHER_EXPORTED = "data.teacher.exported"

    # Guardian events
    GUARDIAN_CREATED = "data.guardian.created"
    GUARDIAN_UPDATED = "data.guardian.updated"
    GUARDIAN_DELETED = "data.guardian.deleted"
    GUARDIAN_EXPORTED = "data.guardian.exported"

    # Absence events
    ABSENCE_CREATED = "data.absence.created"
    ABSENCE_UPDATED = "data.absence.updated"
    ABSENCE_APPROVED = "data.absence.approved"
    ABSENCE_REJECTED = "data.absence.rejected"
    ABSENCE_DELETED = "data.absence.deleted"
    ABSENCE_EXPORTED = "data.absence.exported"

    # Attendance events
    ATTENDANCE_REGISTERED = "attendance.registered"
    ATTENDANCE_PHOTO_UPLOADED = "attendance.photo.uploaded"

    # Withdrawal events
    WITHDRAWAL_INITIATED = "withdrawal.initiated"
    WITHDRAWAL_VERIFIED = "withdrawal.verified"
    WITHDRAWAL_COMPLETED = "withdrawal.completed"
    WITHDRAWAL_CANCELLED = "withdrawal.cancelled"
    WITHDRAWAL_ADMIN_OVERRIDE = "withdrawal.admin_override"

    # Settings events
    PREFERENCES_UPDATED = "settings.preferences.updated"
    CONSENT_CHANGED = "settings.consent.changed"

    # Security events
    RATE_LIMIT_EXCEEDED = "security.rate_limit.exceeded"
    INVALID_TOKEN = "security.token.invalid"
    SUSPICIOUS_ACTIVITY = "security.suspicious"


def audit_log(
    event: AuditEvent,
    *,
    user_id: int | None = None,
    ip_address: str | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    details: dict[str, Any] | None = None,
    success: bool = True,
) -> None:
    """Log a security audit event.

    Args:
        event: The type of audit event
        user_id: ID of the user performing the action (if authenticated)
        ip_address: Client IP address
        resource_type: Type of resource affected (e.g., "student", "attendance")
        resource_id: ID of the affected resource
        details: Additional event-specific details
        success: Whether the action succeeded
    """
    audit_entry = {
        "timestamp": datetime.now(UTC).isoformat(),
        "event": event.value,
        "success": success,
        "user_id": user_id,
        "ip_address": _mask_ip(ip_address) if ip_address else None,
        "resource": {
            "type": resource_type,
            "id": resource_id,
        }
        if resource_type
        else None,
        "details": details,
    }

    # Remove None values for cleaner logs
    audit_entry = {k: v for k, v in audit_entry.items() if v is not None}

    # Log as structured JSON for easy parsing
    logger.bind(audit=True).info(
        "[AUDIT] {event} user={user_id} success={success}",
        event=event.value,
        user_id=user_id or "anonymous",
        success=success,
        extra={"audit_data": json.dumps(audit_entry)},
    )


def _mask_ip(ip: str) -> str:
    """Partially mask IP address for privacy.

    IPv4: 192.168.1.100 -> 192.168.1.***
    IPv6: 2001:db8::1 -> 2001:db8::***
    """
    if ":" in ip:
        # IPv6
        parts = ip.rsplit(":", 1)
        return f"{parts[0]}:***"
    else:
        # IPv4
        parts = ip.rsplit(".", 1)
        return f"{parts[0]}.***"
