"""Course repository stub."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.course import Course


class CourseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[Course]:
        result = await self.session.execute(select(Course).order_by(Course.name))
        return list(result.scalars().all())
