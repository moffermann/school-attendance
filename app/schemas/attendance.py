"""Attendance schemas."""

from datetime import datetime, timedelta
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class AttendanceType(str, Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceEventCreate(BaseModel):
    student_id: int
    device_id: str
    gate_id: str
    type: AttendanceType
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    photo_ref: str | None = None
    local_seq: int | None = None

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, v: datetime) -> datetime:
        now = datetime.utcnow()
        # Allow events up to 1 hour in the future (clock sync tolerance)
        max_future = now + timedelta(hours=1)
        # Allow events up to 7 days in the past (offline sync)
        max_past = now - timedelta(days=7)
        if v > max_future:
            raise ValueError("La fecha del evento no puede estar más de 1 hora en el futuro")
        if v < max_past:
            raise ValueError("La fecha del evento no puede ser mayor a 7 días en el pasado")
        return v


class AttendanceEventRead(AttendanceEventCreate):
    id: int
    synced_at: datetime | None = None
