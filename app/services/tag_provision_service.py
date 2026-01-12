"""Tag provisioning service implementation."""

import hashlib
import hmac
import logging
import secrets

from app.core.config import settings
from app.db.repositories.tags import TagRepository
from app.schemas.tags import TagConfirmRequest, TagProvisionRequest, TagProvisionResponse, TagRead

logger = logging.getLogger(__name__)


class ConcurrentEnrollmentError(Exception):
    """Raised when a student already has an active enrollment process."""

    pass


class TagProvisionService:
    def __init__(self, session):
        self.session = session
        self.repository = TagRepository(session)

    async def provision(self, payload: TagProvisionRequest) -> TagProvisionResponse:
        # Check for concurrent enrollment attempt (PENDING tag < 5 minutes old)
        if await self.repository.has_recent_pending(payload.student_id):
            raise ConcurrentEnrollmentError(
                "Ya existe un proceso de enrolamiento activo para este estudiante. "
                "Espere 5 minutos o cancele el anterior."
            )

        # Note: Multiple active tags allowed per student (QR, NFC, Biometric can coexist)
        # Previous behavior auto-revoked existing tags, but PM confirmed all methods
        # should remain active simultaneously when enrolled.

        token = secrets.token_urlsafe(16)
        tag_hash = hmac.new(settings.secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()
        preview = token[:8].upper()

        tag = await self.repository.create_pending(
            student_id=payload.student_id,
            tag_hash=tag_hash,
            tag_preview=preview,
        )
        await self.session.commit()

        checksum = tag_hash[:12]
        ndef_uri = f"{settings.public_base_url}/t/{token}?sig={checksum}"
        return TagProvisionResponse(ndef_uri=ndef_uri, tag_token_preview=preview, checksum=checksum)

    async def confirm(self, payload: TagConfirmRequest) -> TagRead:
        tag = await self.repository.get_by_preview(payload.student_id, payload.tag_token_preview)
        if not tag:
            raise ValueError("Pending tag not found")

        # R17-CRYPTO1 fix: Verify checksum/signature if provided to prevent tag forgery
        # The checksum was generated during provision and should match
        if hasattr(payload, 'checksum') and payload.checksum:
            expected_checksum = tag.tag_hash[:12] if tag.tag_hash else None
            if expected_checksum and payload.checksum != expected_checksum:
                raise ValueError("Invalid tag checksum - possible forgery attempt")

        tag = await self.repository.confirm(tag=tag, tag_uid=payload.tag_uid)
        await self.session.commit()
        return TagRead(
            id=tag.id,
            student_id=tag.student_id,
            status=tag.status,
            tag_token_preview=tag.tag_token_preview,
        )

    async def revoke(self, tag_id: int) -> TagRead:
        tag = await self.repository.revoke(tag_id)
        await self.session.commit()
        return TagRead(
            id=tag.id,
            student_id=tag.student_id,
            status=tag.status,
            tag_token_preview=tag.tag_token_preview,
        )

    async def cleanup_expired_pending_tags(self) -> int:
        """Clean up PENDING tags that have been waiting more than 1 hour.

        Changes their status to EXPIRED. Should be run periodically via cron/scheduler.

        Returns the count of expired tags.
        """
        count = await self.repository.cleanup_expired_pending(hours=1)
        await self.session.commit()
        if count > 0:
            logger.info(f"Cleaned up {count} expired PENDING tag(s)")
        return count
