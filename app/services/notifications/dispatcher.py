"""Dispatcher for notifications."""

import asyncio

from loguru import logger
from redis import Redis
from rq import Queue

from app.core.config import settings
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.notifications import NotificationRepository
from app.schemas.notifications import NotificationDispatchRequest, NotificationRead, NotificationChannel


class NotificationDispatcher:
    def __init__(self, session, tenant_id: int | None = None, tenant_schema: str | None = None):
        self.session = session
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema
        self.repository = NotificationRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self._redis = Redis.from_url(settings.redis_url)
        self._queue = Queue("notifications", connection=self._redis)

    def __del__(self):
        """Close Redis connection on cleanup (B7 fix)."""
        if hasattr(self, '_redis') and self._redis:
            try:
                self._redis.close()
            except Exception as exc:
                # R2-B13 fix: Log errors instead of silently ignoring
                logger.debug("Error closing Redis connection in destructor: %s", exc)

    async def enqueue_manual_notification(self, payload: NotificationDispatchRequest) -> NotificationRead:
        guardian = await self.guardian_repo.get(payload.guardian_id)
        if not guardian:
            raise ValueError("Guardian not found")

        # TDD-R4-BUG2 fix: Handle guardian.contacts being None
        contact_map = {
            NotificationChannel.WHATSAPP: (guardian.contacts or {}).get("whatsapp"),
            NotificationChannel.EMAIL: (guardian.contacts or {}).get("email"),
        }
        recipient = contact_map[payload.channel]
        if not recipient:
            raise ValueError(f"Guardian has no {payload.channel.value.lower()} configured")

        notification = await self.repository.create(
            guardian_id=payload.guardian_id,
            channel=payload.channel.value,
            template=payload.template.value,
            payload=payload.variables,
            event_id=None,
        )
        await self.session.commit()

        job_func = {
            NotificationChannel.WHATSAPP: "app.workers.jobs.send_whatsapp.send_whatsapp_message",
            NotificationChannel.EMAIL: "app.workers.jobs.send_email.send_email_message",
        }[payload.channel]

        # MT-WORKER-FIX: Pass tenant context so worker can find notification in correct schema
        job_args = (
            notification.id,
            recipient,
            payload.template.value,
            payload.variables,
            self.tenant_id,
            self.tenant_schema,
        )
        self._queue.enqueue(job_func, *job_args)

        return NotificationRead.model_validate(notification, from_attributes=True)
