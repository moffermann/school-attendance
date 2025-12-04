"""Guardian repository stub."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.guardian import Guardian
from app.db.models.student import Student


class GuardianRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, guardian_id: int) -> Guardian | None:
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .where(Guardian.id == guardian_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def save(self, guardian: Guardian) -> Guardian:
        self.session.add(guardian)
        await self.session.flush()
        return guardian

    async def list_by_student_ids(self, student_ids: list[int]) -> list[Guardian]:
        if not student_ids:
            return []
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .join(Guardian.students)
            .where(Student.id.in_(student_ids))
        )
        result = await self.session.execute(stmt)
        # R5-B4 fix: Use .unique() to properly handle duplicates from joined results
        guardians = result.scalars().unique().all()
        return list(guardians)

    async def list_all(self) -> list[Guardian]:
        result = await self.session.execute(select(Guardian).options(selectinload(Guardian.students)))
        return list(result.scalars().all())
