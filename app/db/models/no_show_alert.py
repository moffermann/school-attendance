"""No-show alert model."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NoShowAlert(Base):
    __tablename__ = "no_show_alerts"

    # Unique constraint to prevent duplicate alerts for the same student/guardian/date
    # This prevents race conditions when multiple workers detect no-shows simultaneously
    __table_args__ = (
        UniqueConstraint(
            "student_id", "guardian_id", "alert_date",
            name="uq_no_show_alert_unique"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    guardian_id: Mapped[int] = mapped_column(ForeignKey("guardians.id"), nullable=False, index=True)
    # R12-P10 fix: Add index for GROUP BY course queries
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id"), index=True)
    alert_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    alerted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(String(512))
    notification_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_notification_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student = relationship("Student")
    guardian = relationship("Guardian")
    course = relationship("Course")
    schedule = relationship("Schedule")

