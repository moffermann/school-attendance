"""WhatsApp Cloud API client."""

from __future__ import annotations

from typing import Any

import httpx
from loguru import logger

from app.core.config import settings


class WhatsAppClient:
    def __init__(self) -> None:
        self._access_token = settings.whatsapp_access_token
        self._phone_number_id = settings.whatsapp_phone_number_id

    async def send_template(self, to: str, template: str, components: list[dict[str, Any]]) -> None:
        if not settings.enable_real_notifications:
            logger.info(
                "[WhatsApp] Dry-run send to=%s template=%s components=%s",
                to,
                template,
                components,
            )
            return

        url = f"https://graph.facebook.com/v17.0/{self._phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": "es"},
                "components": components,
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
