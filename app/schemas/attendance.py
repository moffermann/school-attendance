"""Attendance schemas."""

from datetime import datetime, timedelta, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class AttendanceType(str, Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceSource(str, Enum):
    """Method used to register attendance."""
    BIOMETRIC = "BIOMETRIC"  # WebAuthn/Passkey fingerprint
    QR = "QR"                # QR code scan
    NFC = "NFC"              # NFC card/tag
    MANUAL = "MANUAL"        # Manual entry by staff


class AttendanceEventCreate(BaseModel):
    student_id: int
    device_id: str = Field(..., max_length=64)
    gate_id: str = Field(..., max_length=64)
    type: AttendanceType
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photo_ref: str | None = None
    audio_ref: str | None = None
    local_seq: int | None = None
    source: AttendanceSource | None = None  # BIOMETRIC, QR, NFC, MANUAL

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, v: datetime) -> datetime:
        # Ensure timezone-aware comparison
        now = datetime.now(timezone.utc)
        # Make v timezone-aware if it isn't
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
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
    source: AttendanceSource | None = None
