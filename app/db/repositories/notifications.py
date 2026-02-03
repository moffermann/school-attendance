"""Notification repository stub."""

from datetime import UTC, date, datetime
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
        payload: dict[str, Any],
        event_id: int | None = None,
    ) -> Notification:
        notification = Notification(
            guardian_id=guardian_id,
            channel=channel,
            template=template,
            payload=payload,
            event_id=event_id,
            status="queued",
            ts_created=datetime.now(UTC),
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
        notification.ts_sent = datetime.now(UTC)
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

    async def get_or_create(
        self,
        *,
        guardian_id: int,
        channel: str,
        template: str,
        payload: dict[str, Any],
        event_id: int | None = None,
        context_id: int | None = None,
    ) -> tuple[Notification, bool]:
        """Create notification or return existing if duplicate.

        For attendance notifications (INGRESO_OK, SALIDA_OK), this ensures
        only one notification per guardian/channel/template/student/day.

        Returns:
            Tuple of (notification, created) where created=False if duplicate
        """
        notification_date = date.today()

        # For attendance notifications, check for existing
        if template in ("INGRESO_OK", "SALIDA_OK") and context_id is not None:
            existing = await self._find_existing(
                guardian_id=guardian_id,
                channel=channel,
                template=template,
                context_id=context_id,
                notification_date=notification_date,
            )
            if existing:
                logger.debug(
                    f"Found existing notification {existing.id} for "
                    f"guardian={guardian_id}, channel={channel}, template={template}, "
                    f"context_id={context_id}, date={notification_date}"
                )
                return existing, False

        # Create new notification
        notification = Notification(
            guardian_id=guardian_id,
            channel=channel,
            template=template,
            payload=payload,
            event_id=event_id,
            context_id=context_id,
            notification_date=notification_date,
            status="queued",
            ts_created=datetime.now(UTC),
            ts_sent=None,
            retries=0,
        )
        self.session.add(notification)

        try:
            await self.session.flush()
            return notification, True
        except IntegrityError:
            # Race condition: another transaction created first
            await self.session.rollback()
            logger.warning(
                f"IntegrityError on notification create - checking for existing. "
                f"guardian={guardian_id}, channel={channel}, template={template}"
            )
            existing = await self._find_existing(
                guardian_id=guardian_id,
                channel=channel,
                template=template,
                context_id=context_id,
                notification_date=notification_date,
            )
            if existing:
                return existing, False
            raise

    async def _find_existing(
        self,
        *,
        guardian_id: int,
        channel: str,
        template: str,
        context_id: int | None,
        notification_date: date,
    ) -> Notification | None:
        """Find existing notification matching dedup criteria."""
        stmt = (
            select(Notification)
            .where(
                Notification.guardian_id == guardian_id,
                Notification.channel == channel,
                Notification.template == template,
                Notification.context_id == context_id,
                Notification.notification_date == notification_date,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
