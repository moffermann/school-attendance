"""Notification schemas."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class NotificationChannel(StrEnum):
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"
    PUSH = "PUSH"


class NotificationType(StrEnum):
    INGRESO_OK = "INGRESO_OK"
    SALIDA_OK = "SALIDA_OK"
    NO_INGRESO_UMBRAL = "NO_INGRESO_UMBRAL"
    CAMBIO_HORARIO = "CAMBIO_HORARIO"
    BROADCAST = "BROADCAST"  # Comunicados masivos genericos


class NotificationDispatchRequest(BaseModel):
    guardian_id: int
    student_id: int | None = None
    channel: NotificationChannel
    template: NotificationType
    variables: dict[str, Any] = Field(default_factory=dict)


class NotificationRead(BaseModel):
    id: int
    guardian_id: int
    channel: NotificationChannel
    template: NotificationType
    status: str
    ts_created: datetime
    ts_sent: datetime | None = None
    retries: int | None = None


class BroadcastScope(StrEnum):
    """R3-V3 fix: Valid broadcast scope values."""

    GLOBAL = "global"
    COURSE = "course"
    CUSTOM = "custom"


class BroadcastAudience(BaseModel):
    # R3-V3 fix: Use enum for scope validation
    scope: BroadcastScope = Field(..., description="global|course|custom")
    course_ids: list[int] | None = None
    guardian_ids: list[int] | None = None


class BroadcastCreate(BaseModel):
    # R3-V4 fix: Add max_length to text fields
    subject: str = Field(..., max_length=500)
    message: str = Field(..., max_length=5000)
    template: NotificationType
    audience: BroadcastAudience
    scheduled_at: datetime | None = None


class BroadcastPreview(BaseModel):
    subject: str
    message: str
    recipients: int
    dry_run: bool = True


class NotificationLog(NotificationRead):
    payload: dict[str, Any] | None = None
    student_id: int | None = None  # Populated from context_id for student notifications


class NotificationSummaryResponse(BaseModel):
    total: int
    by_status: dict[str, int] = Field(default_factory=dict)
    by_channel: dict[str, int] = Field(default_factory=dict)
    by_template: dict[str, int] = Field(default_factory=dict)
