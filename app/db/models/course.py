"""Course model."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import teacher_course_table


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # R6-M5 fix: Add index for name searches
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    grade: Mapped[str] = mapped_column(String(32), nullable=False)

    students = relationship("Student", back_populates="course")
    schedules = relationship("Schedule", back_populates="course")
    teachers = relationship("Teacher", secondary=teacher_course_table, back_populates="courses")
    # R9-M3 fix: Add enrollments relationship for bidirectional access
    enrollments = relationship("Enrollment", back_populates="course")
