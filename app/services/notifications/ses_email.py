"""SES email client."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger

from app.core.config import settings

if TYPE_CHECKING:
    from app.db.repositories.tenant_configs import DecryptedTenantConfig


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
            logger.info("[SES] Dry-run email to={} subject={}", mask_email(to), subject)
            return

        client = self._get_client()

        # R12-P3 fix: Use asyncio.to_thread to avoid blocking event loop
        def _send():
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

        try:
            await asyncio.to_thread(_send)
        except (ClientError, BotoCoreError) as exc:  # pragma: no cover - network side effect
            logger.error("SES send failed: {}", exc)
            raise


class TenantSESEmailClient:
    """SES email client using tenant-specific credentials."""

    def __init__(self, config: "DecryptedTenantConfig") -> None:
        """
        Initialize with decrypted tenant configuration.

        Args:
            config: Decrypted tenant config containing SES credentials
        """
        self._tenant_id = config.tenant_id
        self._region = config.ses_region or "us-east-1"
        self._source = config.ses_source_email
        self._access_key = config.ses_access_key
        self._secret_key = config.ses_secret_key

        if not self._source:
            raise ValueError(f"SES source email not configured for tenant {config.tenant_id}")

        self._client = None

    def _get_client(self):
        """Lazy initialize boto3 SES client with tenant credentials."""
        if self._client is None:
            # Use tenant-specific credentials if available, otherwise use default AWS credentials
            if self._access_key and self._secret_key:
                self._client = boto3.client(
                    "ses",
                    region_name=self._region,
                    aws_access_key_id=self._access_key,
                    aws_secret_access_key=self._secret_key,
                )
            else:
                # Fall back to default credentials (IAM role or environment)
                self._client = boto3.client("ses", region_name=self._region)
        return self._client

    def close(self) -> None:
        """Close boto3 client connection."""
        if self._client:
            self._client.close()
            self._client = None

    def __del__(self) -> None:
        """Cleanup on garbage collection."""
        try:
            self.close()
        except Exception:
            pass

    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        """Send an email using tenant's SES configuration."""
        if not settings.enable_real_notifications:
            logger.info(
                "[SES:tenant={}] Dry-run email to={} subject={}",
                self._tenant_id,
                mask_email(to),
                subject,
            )
            return

        client = self._get_client()

        def _send():
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

        try:
            await asyncio.to_thread(_send)
            logger.info("[SES:tenant={}] Email sent to={}", self._tenant_id, mask_email(to))
        except (ClientError, BotoCoreError) as exc:
            logger.error("[SES:tenant={}] Send failed: {}", self._tenant_id, exc)
            raise
