"""Withdrawal request model for parent-initiated pickup scheduling."""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.authorized_pickup import AuthorizedPickup
    from app.db.models.guardian import Guardian
    from app.db.models.student import Student
    from app.db.models.student_withdrawal import StudentWithdrawal


class WithdrawalRequestStatus(StrEnum):
    """Status of a parent-initiated withdrawal request.

    State machine:
      PENDING  -> APPROVED | REJECTED | CANCELLED | EXPIRED
      APPROVED -> COMPLETED | CANCELLED
    """

    PENDING = "PENDING"  # Parent submitted, school hasn't reviewed
    APPROVED = "APPROVED"  # School approved
    REJECTED = "REJECTED"  # School rejected
    COMPLETED = "COMPLETED"  # Withdrawal occurred (linked to StudentWithdrawal)
    CANCELLED = "CANCELLED"  # Parent cancelled
    EXPIRED = "EXPIRED"  # Scheduled date passed without withdrawal


class WithdrawalRequest(Base):
    """A parent's request to have their child picked up on a given date.

    Flow:
    1. Parent creates request (PENDING) specifying student, authorized pickup, and date
    2. School staff reviews and approves/rejects
    3. On pickup day, if withdrawal occurs, the system auto-links it (COMPLETED)
    """

    __tablename__ = "withdrawal_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Core references
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True
    )
    authorized_pickup_id: Mapped[int] = mapped_column(
        ForeignKey("authorized_pickups.id"), nullable=False, index=True
    )

    # Request details
    status: Mapped[str] = mapped_column(
        String(20),
        default=WithdrawalRequestStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scheduled_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Who requested
    requested_by_guardian_id: Mapped[int] = mapped_column(
        ForeignKey("guardians.id"), nullable=False, index=True
    )
    # Note: No FK to users — multi-tenant schema isolation
    requested_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # School review
    reviewed_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Link to actual withdrawal
    student_withdrawal_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_withdrawals.id"), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    student: Mapped["Student"] = relationship("Student")
    authorized_pickup: Mapped["AuthorizedPickup"] = relationship("AuthorizedPickup")
    guardian: Mapped["Guardian"] = relationship("Guardian")
    student_withdrawal: Mapped["StudentWithdrawal | None"] = relationship(
        "StudentWithdrawal"
    )

    def __repr__(self) -> str:
        return (
            f"<WithdrawalRequest(id={self.id}, student_id={self.student_id}, "
            f"status='{self.status}', date={self.scheduled_date})>"
        )

    @property
    def is_pending(self) -> bool:
        return self.status == WithdrawalRequestStatus.PENDING.value

    @property
    def is_approved(self) -> bool:
        return self.status == WithdrawalRequestStatus.APPROVED.value

    @property
    def can_be_cancelled(self) -> bool:
        """Parent can cancel if still PENDING or APPROVED."""
        return self.status in (
            WithdrawalRequestStatus.PENDING.value,
            WithdrawalRequestStatus.APPROVED.value,
        )

    @property
    def can_be_reviewed(self) -> bool:
        """School staff can only review PENDING requests."""
        return self.status == WithdrawalRequestStatus.PENDING.value
