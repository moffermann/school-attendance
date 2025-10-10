"""Notification repository stub."""

from datetime import datetime, timezone

from datetime import datetime
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
        notification.status = "failed"
        notification.retries = (notification.retries or 0) + 1
        await self.session.flush()
        return notification
