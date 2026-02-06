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
    """Photo storage service with proper resource cleanup."""

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

    def close(self) -> None:
        """R3-R6 fix: Close boto3 client connection."""
        if self._client:
            self._client.close()

    def __del__(self) -> None:
        """R3-R6 fix: Cleanup on garbage collection."""
        try:
            self.close()
        except Exception:
            pass  # Ignore errors during cleanup

    async def store_photo(self, key: str, data: bytes, content_type: str) -> str:
        # R2-B20 fix: Use asyncio.to_thread to prevent blocking event loop
        # TDD-R3-BUG5 fix: Properly close BytesIO buffer in all paths
        buffer: BinaryIO = io.BytesIO(data)

        def _upload():
            self._client.upload_fileobj(
                buffer,
                Bucket=self._bucket,
                Key=key,
                ExtraArgs={"ContentType": content_type, "ACL": "private"},
            )

        try:
            await asyncio.to_thread(_upload)
            logger.info("Stored photo in bucket=%s key=%s", self._bucket, key)
            return key
        finally:
            buffer.close()

    async def delete_photo(self, key: str) -> None:
        # R2-B20 fix: Use asyncio.to_thread to prevent blocking event loop
        await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)
        logger.info("Deleted photo bucket=%s key=%s", self._bucket, key)

    async def get_photo(self, key: str) -> tuple[bytes, str] | None:
        """Download a photo from S3/MinIO.

        Returns:
            Tuple of (photo_bytes, content_type) or None if not found.
        """
        if not key:
            return None

        def _download():
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            content_type = response.get("ContentType", "image/jpeg")
            data = response["Body"].read()
            return data, content_type

        try:
            return await asyncio.to_thread(_download)
        except self._client.exceptions.NoSuchKey:
            logger.warning("Photo not found: %s", key)
            return None
        except Exception as exc:
            logger.error("Failed to download photo %s: %s", key, exc)
            return None

    async def generate_presigned_url(self, key: str, expires: int = 3600) -> str | None:
        """Generate a presigned URL for accessing a photo.

        R12-P5 fix: Made async to avoid blocking event loop during S3 API call.

        If S3_PUBLIC_URL is configured, the internal endpoint URL in the presigned
        URL will be replaced with the public URL. This is necessary when MinIO
        is accessed from external devices (e.g., kiosk on a phone) that cannot
        reach localhost or Docker container names.

        Returns:
            The presigned URL string, or None if generation fails.
        """
        if not key:
            return None

        def _generate():
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires,
            )

        try:
            url = await asyncio.to_thread(_generate)

            # Replace internal endpoint with public URL if configured
            if settings.s3_public_url and url:
                url = url.replace(settings.s3_endpoint, settings.s3_public_url.rstrip("/"))

            return url
        except Exception as exc:  # pragma: no cover - best effort URL generation
            logger.error("Failed to generate presigned URL for %s: %s", key, exc)
            return None
