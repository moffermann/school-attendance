"""Student withdrawal model for authorized pickup tracking."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.authorized_pickup import AuthorizedPickup
    from app.db.models.student import Student


class WithdrawalVerificationMethod(StrEnum):
    """Method used to verify the identity of the person picking up the student."""

    QR_SCAN = "QR_SCAN"  # QR code scanned from authorized adult
    BIOMETRIC = "BIOMETRIC"  # Fingerprint/Face ID verification
    ADMIN_OVERRIDE = "ADMIN_OVERRIDE"  # Admin manually verified identity
    PHOTO_MATCH = "PHOTO_MATCH"  # Selfie matched against registered photo


class WithdrawalStatus(StrEnum):
    """Status of the withdrawal process.

    State machine: INITIATED -> VERIFIED -> COMPLETED
                   or CANCELLED at any point
    """

    INITIATED = "INITIATED"  # Valid QR/search, waiting for student selection
    VERIFIED = "VERIFIED"  # Identity confirmed, waiting for signature
    COMPLETED = "COMPLETED"  # Signed and completed - student has left
    CANCELLED = "CANCELLED"  # Cancelled by admin or system


class StudentWithdrawal(Base):
    """Auditable record of a student being withdrawn from school.

    This model provides a legal audit trail for each withdrawal including:
    - Who picked up the student (authorized_pickup or admin override)
    - How identity was verified (QR, photo match, admin override)
    - Photo evidence of the pickup
    - Digital signature
    - Device and network metadata
    - Status tracking through the withdrawal process
    """

    __tablename__ = "student_withdrawals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Participants
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True
    )
    authorized_pickup_id: Mapped[int | None] = mapped_column(
        ForeignKey("authorized_pickups.id"), nullable=True, index=True
    )

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20),
        default=WithdrawalStatus.INITIATED.value,
        index=True,
    )

    # Verification
    verification_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Note: No FK constraint - in multi-tenant setup, FKs to users don't work
    # because the FK would point to public.users but users are in tenant schemas.
    verified_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Cancellation (when status = CANCELLED)
    # Note: No FK constraint - same multi-tenant reason as above
    cancelled_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Evidence
    pickup_photo_ref: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # S3/MinIO reference to selfie
    signature_data: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # Base64 PNG/SVG of digital signature

    # Context
    reason: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # Reason for early withdrawal
    device_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # Kiosk device that processed

    # Timestamps
    initiated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Audit metadata
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    student: Mapped["Student"] = relationship("Student", back_populates="withdrawals")
    authorized_pickup: Mapped["AuthorizedPickup | None"] = relationship(
        "AuthorizedPickup", back_populates="withdrawals"
    )
    # Note: User relationships removed - in multi-tenant setup without FK constraints,
    # ORM relationships to users are complex. Use user_id fields directly and
    # query User separately when needed.

    def __repr__(self) -> str:
        return f"<StudentWithdrawal(id={self.id}, student_id={self.student_id}, status='{self.status}')>"

    @property
    def is_complete(self) -> bool:
        """Check if withdrawal has been completed."""
        return self.status == WithdrawalStatus.COMPLETED.value

    @property
    def is_cancelled(self) -> bool:
        """Check if withdrawal was cancelled."""
        return self.status == WithdrawalStatus.CANCELLED.value

    @property
    def can_be_cancelled(self) -> bool:
        """Check if withdrawal can still be cancelled (not completed)."""
        return self.status in (
            WithdrawalStatus.INITIATED.value,
            WithdrawalStatus.VERIFIED.value,
        )
