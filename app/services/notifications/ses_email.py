"""SES email client."""

from __future__ import annotations

from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger

from app.core.config import settings


def mask_email(email: str) -> str:
    """Mask email for logging, showing only first 2 chars and domain."""
    if "@" not in email:
        return "****"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[:2] + "*" * (len(local) - 2)
    return f"{masked_local}@{domain}"


class SESEmailClient:
    """SES email client with connection reuse."""

    def __init__(self) -> None:
        self._region = settings.ses_region
        self._source = settings.ses_source_email
        # R3-R10 fix: Create client once in __init__ and reuse
        self._client = None

    def _get_client(self):
        """Lazy initialize and reuse boto3 SES client."""
        if self._client is None:
            self._client = boto3.client("ses", region_name=self._region)
        return self._client

    def close(self) -> None:
        """R3-R10 fix: Close boto3 client connection."""
        if self._client:
            self._client.close()
            self._client = None

    def __del__(self) -> None:
        """R3-R10 fix: Cleanup on garbage collection."""
        try:
            self.close()
        except Exception:
            pass

    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        if not settings.enable_real_notifications:
            logger.info("[SES] Dry-run email to=%s subject=%s", mask_email(to), subject)
            return

        client = self._get_client()
        try:
            client.send_email(
                Source=self._source,
                Destination={"ToAddresses": [to]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": body_html, "Charset": "UTF-8"},
                    },
                },
            )
        except (ClientError, BotoCoreError) as exc:  # pragma: no cover - network side effect
            logger.error("SES send failed: %s", exc)
            raise
