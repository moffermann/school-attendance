"""Student repository stub."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.student import Student


class StudentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, student_id: int) -> Student | None:
        return await self.session.get(Student, student_id)

    async def list_by_ids(self, student_ids: list[int]) -> list[Student]:
        if not student_ids:
            return []
        stmt = select(Student).where(Student.id.in_(student_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_course_ids(self, course_ids: set[int]) -> list[Student]:
        if not course_ids:
            return []
        stmt = (
            select(Student)
            .where(Student.course_id.in_(course_ids))
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_course(self, course_id: int) -> list[Student]:
        stmt = (
            select(Student)
            .where(Student.course_id == course_id)
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(self, limit: int = 5000) -> list[Student]:
        """List all students for kiosk provisioning.

        R7-B7 fix: Add limit parameter to prevent OOM on large deployments.
        Default is 5000 which should cover most schools.
        """
        stmt = select(Student).order_by(Student.full_name).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_with_guardians(self, student_id: int) -> Student | None:
        """Get a student with their guardians eagerly loaded."""
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_course(self, student_id: int) -> Student | None:
        """Get a student with their course eagerly loaded."""
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(selectinload(Student.course))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_photo_url(self, student_id: int, photo_url: str) -> Student | None:
        """Update a student's photo URL."""
        student = await self.get(student_id)
        if not student:
            return None
        student.photo_url = photo_url
        await self.session.flush()
        return student

    async def update(self, student_id: int, **kwargs) -> Student | None:
        """Update a student's fields."""
        student = await self.get(student_id)
        if not student:
            return None
        for key, value in kwargs.items():
            if hasattr(student, key):
                setattr(student, key, value)
        await self.session.flush()
        return student
