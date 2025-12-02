"""RQ job for SES email send."""

from __future__ import annotations

import asyncio
from loguru import logger

from app.db.repositories.notifications import NotificationRepository
from app.db.session import async_session
from app.services.notifications.ses_email import SESEmailClient, mask_email


async def _send(notification_id: int, to: str, template: str, variables: dict) -> None:
    async with async_session() as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification %s not found", notification_id)
            return

        client = SESEmailClient()
        subject = f"Notificación {template.replace('_', ' ').title()}"
        body_lines = [f"<p><strong>{key}</strong>: {value}</p>" for key, value in variables.items()]
        body_html = "".join(body_lines) or "<p>Se ha generado una notificación.</p>"

        try:
            await client.send_email(to=to, subject=subject, body_html=body_html)
            await repo.mark_sent(notification)
            await session.commit()
            logger.info("[Worker] Email sent notification_id=%s to=%s", notification_id, mask_email(to))
        except Exception as exc:  # pragma: no cover - network failure
            await repo.mark_failed(notification)
            await session.commit()
            logger.error("Email send failed notification_id=%s error=%s", notification_id, exc)
            raise


def send_email_message(notification_id: int, to: str, template: str, variables: dict) -> None:
    asyncio.run(_send(notification_id, to, template, variables))
