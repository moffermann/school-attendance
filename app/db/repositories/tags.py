"""Tag repository stub."""

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

    async def confirm(self, *, tag: Tag, tag_uid: str | None = None) -> Tag:
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
