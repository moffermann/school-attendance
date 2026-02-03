"""Attendance event model."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttendanceTypeEnum(str, Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceSourceEnum(str, Enum):
    """Method used to register attendance."""
    BIOMETRIC = "BIOMETRIC"  # WebAuthn/Passkey fingerprint
    QR = "QR"                # QR code scan
    NFC = "NFC"              # NFC card/tag
    MANUAL = "MANUAL"        # Manual entry by staff


class AttendanceEvent(Base):
    __tablename__ = "attendance_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(SAEnum(AttendanceTypeEnum, name="attendance_type"), nullable=False)
    gate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    device_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    local_seq: Mapped[int | None] = mapped_column(Integer)
    photo_ref: Mapped[str | None] = mapped_column(String(512))
    audio_ref: Mapped[str | None] = mapped_column(String(512))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Method used to register attendance (BIOMETRIC, QR, NFC, MANUAL)
    source: Mapped[str | None] = mapped_column(
        SAEnum(AttendanceSourceEnum, name="attendance_source"),
        nullable=True,  # Nullable for backward compatibility with existing records
        index=True
    )
    # Flag for events with auto-corrected sequence (IN↔OUT)
    conflict_corrected: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    student = relationship("Student")
