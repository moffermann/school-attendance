"""Sequence correction audit log model."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utc_now() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class SequenceCorrection(Base):
    """Audit log for auto-corrected attendance event sequences.

    Registra cada vez que el servidor corrige IN↔OUT para análisis
    de dispositivos problemáticos y patrones de sincronización.
    """
    __tablename__ = "sequence_corrections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_events.id"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True
    )
    requested_type: Mapped[str] = mapped_column(String(10), nullable=False)  # IN or OUT
    corrected_type: Mapped[str] = mapped_column(String(10), nullable=False)   # IN or OUT
    device_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    gate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    corrected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utc_now, index=True
    )

    # Relationships for queries
    event = relationship("AttendanceEvent")
    student = relationship("Student")
