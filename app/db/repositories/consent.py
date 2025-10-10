"""Consent repository stub."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.guardian import Guardian


class ConsentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_guardian(self, guardian_id: int) -> Guardian | None:
        return await self.session.get(Guardian, guardian_id)
