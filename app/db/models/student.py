"""Student model."""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import student_guardian_table
from app.db.models.authorized_pickup import student_authorized_pickup_table


class EvidencePreference(StrEnum):
    """Evidence capture preference for attendance."""

    PHOTO = "photo"
    AUDIO = "audio"
    NONE = "none"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # National ID (RUT in Chile, DNI in Argentina, etc.)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # R12-P2 fix: Add index for course filtering queries
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    # R12-P8 fix: Add index for active student filtering
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", index=True)
    qr_code_hash: Mapped[str | None] = mapped_column(String(128))
    # URL or path to student photo
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Legacy field - maintained for backward compatibility
    photo_pref_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    # New evidence preference: "photo", "audio", or "none"
    evidence_preference: Mapped[str] = mapped_column(String(16), default="none")

    # Timestamps for audit trail
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    course = relationship("Course", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    guardians = relationship(
        "Guardian", secondary=student_guardian_table, back_populates="students"
    )
    webauthn_credentials = relationship(
        "WebAuthnCredential", back_populates="student", cascade="all, delete-orphan"
    )
    # Authorized pickups (adults who can withdraw this student)
    authorized_pickups = relationship(
        "AuthorizedPickup",
        secondary=student_authorized_pickup_table,
        back_populates="students",
    )
    # Withdrawal records
    withdrawals = relationship(
        "StudentWithdrawal", back_populates="student", cascade="all, delete-orphan"
    )

    @property
    def effective_evidence_preference(self) -> str:
        """Get the effective evidence preference, considering legacy field."""
        # If new field is set, use it
        if self.evidence_preference and self.evidence_preference != "none":
            return self.evidence_preference
        # Fall back to legacy photo_pref_opt_in
        if self.photo_pref_opt_in:
            return EvidencePreference.PHOTO.value
        return EvidencePreference.NONE.value
