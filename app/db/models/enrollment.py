"""Enrollment model."""

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Enrollment(Base):
    __tablename__ = "enrollments"
    # R9-M8 fix: Prevent duplicate enrollments
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", "school_year", name="uq_enrollment_unique"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    school_year: Mapped[str] = mapped_column(String(16), nullable=False)

    student = relationship("Student", back_populates="enrollments")
    # R9-M3 fix: Add back_populates for bidirectional relationship
    course = relationship("Course", back_populates="enrollments")
