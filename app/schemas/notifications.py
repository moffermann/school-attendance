"""Notification schemas."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class NotificationChannel(str, Enum):
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"


class NotificationType(str, Enum):
    INGRESO_OK = "INGRESO_OK"
    SALIDA_OK = "SALIDA_OK"
    NO_INGRESO_UMBRAL = "NO_INGRESO_UMBRAL"
    CAMBIO_HORARIO = "CAMBIO_HORARIO"


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


class BroadcastAudience(BaseModel):
    scope: str = Field(..., description="global|course|custom")
    course_ids: list[int] | None = None
    guardian_ids: list[int] | None = None


class BroadcastCreate(BaseModel):
    subject: str
    message: str
    template: NotificationType
    audience: BroadcastAudience
    scheduled_at: datetime | None = None


class BroadcastPreview(BaseModel):
    subject: str
    message: str
    recipients: int
    dry_run: bool = True
