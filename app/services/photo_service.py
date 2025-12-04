"""Photo storage service."""

from __future__ import annotations

import asyncio
import io
from typing import BinaryIO

import boto3
from botocore.client import Config
from loguru import logger

from app.core.config import settings


class PhotoService:
    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
            use_ssl=settings.s3_secure,
        )
        self._bucket = settings.s3_bucket

    async def store_photo(self, key: str, data: bytes, content_type: str) -> str:
        # R2-B20 fix: Use asyncio.to_thread to prevent blocking event loop
        buffer: BinaryIO = io.BytesIO(data)

        def _upload():
            self._client.upload_fileobj(
                buffer,
                Bucket=self._bucket,
                Key=key,
                ExtraArgs={"ContentType": content_type, "ACL": "private"},
            )

        await asyncio.to_thread(_upload)
        logger.info("Stored photo in bucket=%s key=%s", self._bucket, key)
        return key

    async def delete_photo(self, key: str) -> None:
        # R2-B20 fix: Use asyncio.to_thread to prevent blocking event loop
        await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)
        logger.info("Deleted photo bucket=%s key=%s", self._bucket, key)

    def generate_presigned_url(self, key: str, expires: int = 3600) -> str | None:
        """Generate a presigned URL for accessing a photo.

        Returns:
            The presigned URL string, or None if generation fails.
        """
        if not key:
            return None

        try:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires,
            )
        except Exception as exc:  # pragma: no cover - best effort URL generation
            logger.error("Failed to generate presigned URL for %s: %s", key, exc)
            return None
