"""RQ job for processing broadcast audience."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from loguru import logger

from app.db.session import get_worker_session
from app.schemas.notifications import (
    NotificationChannel,
    NotificationDispatchRequest,
    NotificationType,
)
from app.services.notifications.dispatcher import NotificationDispatcher


@asynccontextmanager
async def _get_session(tenant_schema: str | None):
    """Get session with proper tenant context for worker jobs.

    Uses get_worker_session which creates a fresh engine for each job,
    avoiding greenlet_spawn errors when running in RQ/APScheduler workers.
    """
    async with get_worker_session(tenant_schema) as session:
        yield session


async def _process(job_payload: dict[str, Any]) -> None:
    job_id = job_payload.get("job_id")
    guardian_ids = job_payload.get("guardian_ids", [])
    payload = job_payload.get("payload", {})
    tenant_id = job_payload.get("tenant_id")
    tenant_schema = job_payload.get("tenant_schema")
    message = payload.get("message", "")
    subject = payload.get("subject", "")
    variables_base = {"message": message, "subject": subject}

    async with _get_session(tenant_schema) as session:
        dispatcher = NotificationDispatcher(
            session, tenant_id=tenant_id, tenant_schema=tenant_schema
        )
        notification_template = payload.get("template", NotificationType.CAMBIO_HORARIO.value)
        template_enum = (
            notification_template
            if isinstance(notification_template, NotificationType)
            else NotificationType(notification_template)
        )

        for guardian_id in guardian_ids:
            for channel in (NotificationChannel.WHATSAPP, NotificationChannel.EMAIL):
                request = NotificationDispatchRequest(
                    guardian_id=guardian_id,
                    student_id=None,
                    channel=channel,
                    template=template_enum,
                    variables=variables_base,
                )
                try:
                    await dispatcher.enqueue_manual_notification(request)
                except Exception as exc:  # pragma: no cover
                    logger.error(
                        "[BroadcastJob] Failed guardian=%s channel=%s job=%s error=%s",
                        guardian_id,
                        channel,
                        job_id,
                        exc,
                    )


def process_broadcast_job(job_payload: dict[str, Any]) -> None:
    asyncio.run(_process(job_payload))
