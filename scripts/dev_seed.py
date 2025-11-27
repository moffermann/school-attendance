"""Seed script for development."""

from __future__ import annotations

import asyncio
from pathlib import Path
from datetime import datetime, time

import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from sqlalchemy import delete, insert

from app.db.models import (
    Course,
    Student,
    Guardian,
    Enrollment,
    Schedule,
    Tag,
    Teacher,
    User,
)
from app.db.session import async_session
from app.core.security import hash_password


async def seed() -> None:
    async with async_session() as session:
        # limpiar tablas principales
        for model in [User, Tag, Schedule, Enrollment, Student, Guardian, Teacher, Course]:
            await session.execute(delete(model))

        # cursos
        courses = [
            Course(name="1° Básico A", grade="1A"),
            Course(name="2° Básico B", grade="2B"),
        ]
        session.add_all(courses)
        await session.flush()

        # guardians
        guardians = [
            Guardian(
                full_name="María González",
                contacts={"whatsapp": "+56911111111", "email": "maria@example.com"},
                notification_prefs={},
            ),
            Guardian(
                full_name="Juan Pérez",
                contacts={"whatsapp": "+56922222222", "email": "juan@example.com"},
                notification_prefs={},
            ),
        ]
        session.add_all(guardians)
        await session.flush()

        # estudiantes
        students = [
            Student(full_name="Sofía González", course_id=courses[0].id, status="ACTIVE"),
            Student(full_name="Matías Pérez", course_id=courses[0].id, status="ACTIVE"),
            Student(full_name="Isidora López", course_id=courses[1].id, status="ACTIVE"),
        ]
        session.add_all(students)
        await session.flush()

        # enrollments
        session.add_all(
            [
                Enrollment(student_id=students[0].id, course_id=courses[0].id, school_year="2024"),
                Enrollment(student_id=students[1].id, course_id=courses[0].id, school_year="2024"),
                Enrollment(student_id=students[2].id, course_id=courses[1].id, school_year="2024"),
            ]
        )

        from app.db.models.associations import student_guardian_table

        await session.execute(
            insert(student_guardian_table),
            [
                {"student_id": students[0].id, "guardian_id": guardians[0].id},
                {"student_id": students[2].id, "guardian_id": guardians[0].id},
                {"student_id": students[1].id, "guardian_id": guardians[1].id},
            ],
        )

        # horarios
        schedules = [
            Schedule(course_id=courses[0].id, weekday=0, in_time=time(8, 0), out_time=time(13, 30)),
            Schedule(course_id=courses[0].id, weekday=1, in_time=time(8, 0), out_time=time(13, 30)),
            Schedule(course_id=courses[1].id, weekday=0, in_time=time(8, 15), out_time=time(13, 45)),
        ]
        session.add_all(schedules)

        # profesores
        teacher = Teacher(
            full_name="Carlos Profesor",
            email="profesor@example.com",
            status="ACTIVE",
        )
        teacher.courses = [courses[0], courses[1]]  # asignar ambos cursos
        session.add(teacher)
        await session.flush()

        session.add_all(
            [
                User(
                    email="director@example.com",
                    full_name="Ana Directora",
                    role="DIRECTOR",
                    hashed_password=hash_password("secret123"),
                ),
                User(
                    email="inspector@example.com",
                    full_name="Pedro Inspector",
                    role="INSPECTOR",
                    hashed_password=hash_password("secret123"),
                ),
                User(
                    email="maria@example.com",
                    full_name="María González",
                    role="PARENT",
                    hashed_password=hash_password("secret123"),
                    guardian_id=guardians[0].id,
                ),
                User(
                    email="profesor@example.com",
                    full_name="Carlos Profesor",
                    role="TEACHER",
                    hashed_password=hash_password("secret123"),
                    teacher_id=teacher.id,
                ),
            ]
        )

        await session.commit()

    print("Seed data loaded ✅")


async def main() -> None:  # pragma: no cover - script runner
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
