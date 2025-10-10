"""Absence request repository stub."""

from sqlalchemy.ext.asyncio import AsyncSession


class AbsenceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_request(self, *args, **kwargs):  # pragma: no cover - placeholder
        raise NotImplementedError
