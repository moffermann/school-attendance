"""Course model."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    grade: Mapped[str] = mapped_column(String(32), nullable=False)

    students = relationship("Student", back_populates="course")
    schedules = relationship("Schedule", back_populates="course")
