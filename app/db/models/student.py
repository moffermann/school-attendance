"""Student model."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import student_guardian_table


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    qr_code_hash: Mapped[str | None] = mapped_column(String(128))
    photo_pref_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)

    course = relationship("Course", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student")
    guardians = relationship("Guardian", secondary=student_guardian_table, back_populates="students")
