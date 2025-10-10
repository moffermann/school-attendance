"""RQ job for WhatsApp send."""

from __future__ import annotations

import asyncio
from loguru import logger

from app.db.repositories.notifications import NotificationRepository
from app.db.session import async_session
from app.services.notifications.whatsapp import WhatsAppClient


async def _send(notification_id: int, to: str, template: str, variables: dict) -> None:
    async with async_session() as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification %s not found", notification_id)
            return

        client = WhatsAppClient()
        try:
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(value)} for value in variables.values()
                    ],
                }
            ] if variables else []
            await client.send_template(to=to, template=template, components=components)
            await repo.mark_sent(notification)
            await session.commit()
            logger.info("[Worker] WhatsApp sent notification_id=%s to=%s", notification_id, to)
        except Exception as exc:  # pragma: no cover - network failure
            await repo.mark_failed(notification)
            await session.commit()
            logger.error("WhatsApp send failed notification_id=%s error=%s", notification_id, exc)
            raise


def send_whatsapp_message(notification_id: int, to: str, template: str, variables: dict) -> None:
    asyncio.run(_send(notification_id, to, template, variables))
