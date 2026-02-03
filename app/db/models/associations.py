"""Association tables."""

from sqlalchemy import Column, ForeignKey, Table

from app.db.base import Base

student_guardian_table = Table(
    "student_guardians",
    Base.metadata,
    Column("student_id", ForeignKey("students.id"), primary_key=True),
    Column("guardian_id", ForeignKey("guardians.id"), primary_key=True),
)


teacher_course_table = Table(
    "teacher_courses",
    Base.metadata,
    Column("teacher_id", ForeignKey("teachers.id"), primary_key=True),
    Column("course_id", ForeignKey("courses.id"), primary_key=True),
)
