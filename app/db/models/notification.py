"""Notification model."""

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utc_now() -> datetime:
    """R6-M1 fix: Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_events.id"), index=True)
    guardian_id: Mapped[int] = mapped_column(ForeignKey("guardians.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    template: Mapped[str] = mapped_column(String(64), nullable=False)
    # R15-MDL1 fix: Use lambda factory instead of mutable default dict
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    # R6-M1 fix: Use timezone-aware datetime
    ts_created: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utc_now, index=True)
    # R12-P9 fix: Add index for worker time-range queries
    ts_sent: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    retries: Mapped[int] = mapped_column(Integer, default=0)

    # Deduplication fields for attendance notifications
    notification_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    context_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    __table_args__ = (
        # Partial unique index for attendance notification deduplication
        # Ensures only 1 notification per guardian/channel/template/student/day
        Index(
            'ix_notifications_dedup',
            'guardian_id', 'channel', 'template', 'context_id', 'notification_date',
            unique=True,
            postgresql_where=text(
                "template IN ('INGRESO_OK', 'SALIDA_OK') AND context_id IS NOT NULL"
            )
        ),
    )
