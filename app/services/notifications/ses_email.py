"""SES email client."""

from __future__ import annotations

from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger

from app.core.config import settings


class SESEmailClient:
    def __init__(self) -> None:
        self._region = settings.ses_region
        self._source = settings.ses_source_email

    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        if not settings.enable_real_notifications:
            logger.info("[SES] Dry-run email to=%s subject=%s", to, subject)
            return

        client = boto3.client("ses", region_name=self._region)
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
