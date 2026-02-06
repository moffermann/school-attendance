"""UserInvitation repository."""

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user_invitation import UserInvitation


class UserInvitationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        user_id: int,
        email: str,
        token_hash: str,
        purpose: str,
        expires_at: datetime,
    ) -> UserInvitation:
        invitation = UserInvitation(
            user_id=user_id,
            email=email,
            token_hash=token_hash,
            purpose=purpose,
            expires_at=expires_at,
        )
        self.session.add(invitation)
        await self.session.flush()
        return invitation

    async def get_by_token_hash(self, token_hash: str) -> UserInvitation | None:
        stmt = select(UserInvitation).where(UserInvitation.token_hash == token_hash)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_used(self, invitation_id: int) -> None:
        stmt = (
            update(UserInvitation)
            .where(UserInvitation.id == invitation_id)
            .values(used_at=datetime.now(UTC))
        )
        await self.session.execute(stmt)

    async def invalidate_pending(self, user_id: int, purpose: str) -> None:
        """Mark all pending invitations for this user/purpose as used (invalidated)."""
        stmt = (
            update(UserInvitation)
            .where(
                UserInvitation.user_id == user_id,
                UserInvitation.purpose == purpose,
                UserInvitation.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )
        await self.session.execute(stmt)
