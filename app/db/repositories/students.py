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

    async def list_all(self) -> list[Student]:
        """List all students for kiosk provisioning."""
        stmt = select(Student).order_by(Student.full_name)
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
