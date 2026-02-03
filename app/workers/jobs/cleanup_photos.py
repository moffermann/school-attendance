"""RQ job for deleting expired photos."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from loguru import logger

from app.core.config import settings
from app.db.repositories.attendance import AttendanceRepository
from app.db.session import async_session
from app.services.photo_service import PhotoService


async def _cleanup() -> None:
    cutoff = datetime.now(UTC) - timedelta(days=settings.photo_retention_days)
    async with async_session() as session:
        repo = AttendanceRepository(session)
        photo_service = PhotoService()
        expired = await repo.events_with_photo_before(cutoff)
        if not expired:
            logger.info("[CleanupPhotos] No expired photos before {}", cutoff)
            return

        for event in expired:
            if not event.photo_ref:
                continue
            try:
                await photo_service.delete_photo(event.photo_ref)
                await repo.update_photo_ref(event.id, None)
            except Exception as exc:  # pragma: no cover
                logger.error("[CleanupPhotos] Failed to delete {}: {}", event.photo_ref, exc)
        await session.commit()
        logger.info("[CleanupPhotos] Removed {} expired photos", len(expired))


def cleanup_expired_photos() -> None:
    asyncio.run(_cleanup())
