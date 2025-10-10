"""Schemas for no-show alerts."""

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel


class NoShowAlertStatus(str, Enum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"


class NoShowAlertRead(BaseModel):
    id: int
    student_id: int
    guardian_id: int
    course_id: int
    schedule_id: int | None
    alert_date: date
    alerted_at: datetime
    status: str
    resolved_at: datetime | None
    notes: str | None = None
    notification_attempts: int
    last_notification_at: datetime | None
    student_name: str | None = None
    guardian_name: str | None = None
    course_name: str | None = None


class NoShowAlertResolve(BaseModel):
    notes: str | None = None
