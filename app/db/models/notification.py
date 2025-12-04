"""Notification model."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
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
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    # R6-M1 fix: Use timezone-aware datetime
    ts_created: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utc_now, index=True)
    ts_sent: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retries: Mapped[int] = mapped_column(Integer, default=0)
