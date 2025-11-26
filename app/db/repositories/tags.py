"""Tag repository with race condition protection."""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tag import Tag


class TagRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_pending(
        self, *, student_id: int, tag_hash: str, tag_preview: str
    ) -> Tag:
        tag = Tag(
            student_id=student_id,
            tag_token_hash=tag_hash,
            tag_token_preview=tag_preview,
            status="PENDING",
            created_at=datetime.utcnow(),
        )
        self.session.add(tag)
        await self.session.flush()
        return tag

    async def get_by_preview(self, student_id: int, tag_preview: str) -> Tag | None:
        stmt = select(Tag).where(
            Tag.student_id == student_id,
            Tag.tag_token_preview == tag_preview,
            Tag.status.in_(["PENDING", "ACTIVE"]),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_preview_for_update(
        self, student_id: int, tag_preview: str
    ) -> Tag | None:
        """Get tag with row-level lock to prevent race conditions during confirmation.

        Uses SELECT FOR UPDATE to lock the row until the transaction completes.
        This prevents multiple concurrent requests from confirming the same tag.
        """
        stmt = (
            select(Tag)
            .where(
                Tag.student_id == student_id,
                Tag.tag_token_preview == tag_preview,
                Tag.status == "PENDING",  # Only pending tags can be confirmed
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def confirm(self, *, tag: Tag, tag_uid: str | None = None) -> Tag:
        tag.status = "ACTIVE"
        tag.tag_uid = tag_uid
        await self.session.flush()
        return tag

    async def confirm_by_preview_atomic(
        self, student_id: int, tag_preview: str, tag_uid: str | None = None
    ) -> Tag | None:
        """Atomically find and confirm a pending tag.

        This method combines get and confirm in a single operation with row locking
        to prevent race conditions when multiple requests try to confirm the same tag.

        Returns the confirmed tag or None if no pending tag was found.
        """
        tag = await self.get_by_preview_for_update(student_id, tag_preview)
        if tag is None:
            return None
        tag.status = "ACTIVE"
        tag.tag_uid = tag_uid
        await self.session.flush()
        return tag

    async def revoke(self, tag_id: int) -> Tag:
        stmt = select(Tag).where(Tag.id == tag_id)
        result = await self.session.execute(stmt)
        tag = result.scalar_one_or_none()
        if tag is None:
            raise ValueError("Tag not found")
        tag.status = "REVOKED"
        tag.revoked_at = datetime.utcnow()
        await self.session.flush()
        return tag
