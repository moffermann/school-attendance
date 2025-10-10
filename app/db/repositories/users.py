"""User repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def create(self, *, email: str, full_name: str, role: str, hashed_password: str, guardian_id: int | None = None) -> User:
        user = User(
            email=email,
            full_name=full_name,
            role=role,
            hashed_password=hashed_password,
            guardian_id=guardian_id,
        )
        self.session.add(user)
        await self.session.flush()
        return user
