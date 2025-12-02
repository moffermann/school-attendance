"""Student model."""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import student_guardian_table


class EvidencePreference(str, PyEnum):
    """Evidence capture preference for attendance."""

    PHOTO = "photo"
    AUDIO = "audio"
    NONE = "none"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    qr_code_hash: Mapped[str | None] = mapped_column(String(128))
    # Legacy field - maintained for backward compatibility
    photo_pref_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    # New evidence preference: "photo", "audio", or "none"
    evidence_preference: Mapped[str] = mapped_column(String(16), default="none")

    course = relationship("Course", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student")
    guardians = relationship("Guardian", secondary=student_guardian_table, back_populates="students")
    webauthn_credentials = relationship(
        "WebAuthnCredential", back_populates="student", cascade="all, delete-orphan"
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
