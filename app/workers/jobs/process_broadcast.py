"""RQ job for processing broadcast audience."""

from __future__ import annotations

import asyncio
from loguru import logger

from app.db.session import async_session
from app.schemas.notifications import NotificationChannel, NotificationDispatchRequest, NotificationType
from app.services.notifications.dispatcher import NotificationDispatcher


async def _process(job_payload: dict) -> None:
    job_id = job_payload.get("job_id")
    guardian_ids = job_payload.get("guardian_ids", [])
    payload = job_payload.get("payload", {})
    message = payload.get("message", "")
    subject = payload.get("subject", "")
    variables_base = {"message": message, "subject": subject}

    async with async_session() as session:
        dispatcher = NotificationDispatcher(session)
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


def process_broadcast_job(job_payload: dict) -> None:
    asyncio.run(_process(job_payload))
