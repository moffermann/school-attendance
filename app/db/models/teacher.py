"""Teacher model."""

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import teacher_course_table


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")

    # Permission to enroll students for biometric authentication from kiosk
    can_enroll_biometric: Mapped[bool] = mapped_column(Boolean, default=False)

    # Many-to-many relationship with courses
    courses = relationship("Course", secondary=teacher_course_table, back_populates="teachers")
