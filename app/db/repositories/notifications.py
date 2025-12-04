"""Notification repository stub."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.notification import Notification


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        guardian_id: int,
        channel: str,
        template: str,
        payload: dict,
        event_id: int | None = None,
    ) -> Notification:
        notification = Notification(
            guardian_id=guardian_id,
            channel=channel,
            template=template,
            payload=payload,
            event_id=event_id,
            status="queued",
            ts_created=datetime.now(timezone.utc),
            ts_sent=None,
            retries=0,
        )
        self.session.add(notification)
        await self.session.flush()
        return notification

    async def get(self, notification_id: int) -> Notification | None:
        return await self.session.get(Notification, notification_id)

    async def mark_sent(self, notification: Notification) -> Notification:
        notification.status = "sent"
        notification.ts_sent = datetime.now(timezone.utc)
        await self.session.flush()
        return notification

    async def mark_failed(self, notification: Notification) -> Notification:
        """Mark notification as failed.

        R9-W10 fix: Do NOT increment retries here - caller handles retry counting.
        This prevents double increment when both caller and this method increment.
        """
        notification.status = "failed"
        # Note: retries is incremented by the caller (send_whatsapp.py, send_email.py)
        await self.session.flush()
        return notification

    async def list_notifications(
        self,
        *,
        guardian_ids: list[int] | None = None,
        status: str | None = None,
        channel: str | None = None,
        template: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 200,
    ) -> list[Notification]:
        stmt = select(Notification).order_by(Notification.ts_created.desc()).limit(limit)
        if guardian_ids:
            stmt = stmt.where(Notification.guardian_id.in_(guardian_ids))
        if status:
            stmt = stmt.where(Notification.status == status)
        if channel:
            stmt = stmt.where(Notification.channel == channel)
        if template:
            stmt = stmt.where(Notification.template == template)
        if start:
            stmt = stmt.where(Notification.ts_created >= start)
        if end:
            stmt = stmt.where(Notification.ts_created <= end)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
