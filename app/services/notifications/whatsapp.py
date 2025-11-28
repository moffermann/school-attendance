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
        self._base_url = f"https://graph.facebook.com/v17.0/{self._phone_number_id}/messages"

    async def send_template(self, to: str, template: str, components: list[dict[str, Any]]) -> None:
        if not settings.enable_real_notifications:
            logger.info(
                "[WhatsApp] Dry-run send to=%s template=%s components=%s",
                to,
                template,
                components,
            )
            return

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
            response = await client.post(self._base_url, headers=headers, json=payload)
            response.raise_for_status()

    async def send_image_message(
        self,
        to: str,
        image_url: str,
        caption: str,
    ) -> None:
        """
        Send an image message with caption via WhatsApp.

        Args:
            to: Recipient phone number in international format
            image_url: Public URL of the image (must be accessible by WhatsApp)
            caption: Text caption to include with the image
        """
        if not settings.enable_real_notifications:
            logger.info(
                "[WhatsApp] Dry-run image send to=%s image_url=%s caption=%s",
                to,
                image_url,
                caption[:50] + "..." if len(caption) > 50 else caption,
            )
            return

        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "image",
            "image": {
                "link": image_url,
                "caption": caption,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self._base_url, headers=headers, json=payload)
            response.raise_for_status()
            logger.info("[WhatsApp] Image message sent to=%s", to)
