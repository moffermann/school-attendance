"""Push subscription repository."""

from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.push_subscription import PushSubscription


class PushSubscriptionRepository:
    """Repository for push subscription CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, subscription_id: int) -> PushSubscription | None:
        """Get a subscription by ID."""
        return await self.session.get(PushSubscription, subscription_id)

    async def get_by_endpoint(self, endpoint: str) -> PushSubscription | None:
        """Get a subscription by its endpoint URL."""
        stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_guardian(self, guardian_id: int) -> list[PushSubscription]:
        """List all active subscriptions for a guardian."""
        stmt = (
            select(PushSubscription)
            .where(
                PushSubscription.guardian_id == guardian_id,
                PushSubscription.is_active == True,  # noqa: E712
            )
            .order_by(PushSubscription.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_active_by_guardian(self, guardian_id: int) -> list[PushSubscription]:
        """List all active subscriptions for a guardian (alias for list_by_guardian)."""
        return await self.list_by_guardian(guardian_id)

    async def create(
        self,
        guardian_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None = None,
        device_name: str | None = None,
    ) -> PushSubscription:
        """Create a new push subscription."""
        subscription = PushSubscription(
            guardian_id=guardian_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=user_agent,
            device_name=device_name,
            is_active=True,
        )
        self.session.add(subscription)
        await self.session.flush()
        return subscription

    async def update_or_create(
        self,
        guardian_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None = None,
        device_name: str | None = None,
    ) -> PushSubscription:
        """Update existing subscription or create new one."""
        existing = await self.get_by_endpoint(endpoint)

        if existing:
            # Update existing subscription
            existing.p256dh = p256dh
            existing.auth = auth
            existing.is_active = True
            existing.updated_at = datetime.now(timezone.utc)
            if user_agent:
                existing.user_agent = user_agent
            if device_name:
                existing.device_name = device_name
            await self.session.flush()
            return existing

        # Create new subscription
        return await self.create(
            guardian_id=guardian_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=user_agent,
            device_name=device_name,
        )

    async def deactivate(self, subscription_id: int) -> bool:
        """Deactivate a subscription. Returns True if found and deactivated."""
        stmt = (
            update(PushSubscription)
            .where(PushSubscription.id == subscription_id)
            .values(is_active=False, updated_at=datetime.now(timezone.utc))
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def deactivate_by_endpoint(self, endpoint: str) -> bool:
        """Deactivate a subscription by endpoint. Returns True if found and deactivated."""
        stmt = (
            update(PushSubscription)
            .where(PushSubscription.endpoint == endpoint)
            .values(is_active=False, updated_at=datetime.now(timezone.utc))
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def delete(self, subscription_id: int) -> bool:
        """Delete a subscription. Returns True if found and deleted."""
        subscription = await self.get_by_id(subscription_id)
        if subscription:
            await self.session.delete(subscription)
            await self.session.flush()
            return True
        return False

    async def delete_by_endpoint(self, endpoint: str) -> bool:
        """Delete a subscription by endpoint. Returns True if found and deleted."""
        stmt = delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def delete_all_for_guardian(self, guardian_id: int) -> int:
        """Delete all subscriptions for a guardian. Returns count of deleted."""
        stmt = delete(PushSubscription).where(PushSubscription.guardian_id == guardian_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount
