"""WebAuthn credential repository."""

from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.webauthn_credential import WebAuthnCredential


class WebAuthnRepository:
    """Repository for WebAuthn credential CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_credential_id(self, credential_id: str) -> WebAuthnCredential | None:
        """Get a credential by its WebAuthn credential ID."""
        return await self.session.get(WebAuthnCredential, credential_id)

    async def get_by_user_handle(self, user_handle: bytes) -> WebAuthnCredential | None:
        """Get a credential by its user handle (returned during authentication)."""
        stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_handle == user_handle)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_student(self, student_id: int) -> list[WebAuthnCredential]:
        """List all credentials for a student."""
        stmt = (
            select(WebAuthnCredential)
            .where(WebAuthnCredential.student_id == student_id)
            .order_by(WebAuthnCredential.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_user(self, user_id: int) -> list[WebAuthnCredential]:
        """List all credentials for a user (web-app/teacher-pwa login)."""
        stmt = (
            select(WebAuthnCredential)
            .where(WebAuthnCredential.user_id == user_id)
            .order_by(WebAuthnCredential.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_student_credentials(self) -> list[WebAuthnCredential]:
        """Get all credentials linked to students (for kiosk authentication)."""
        stmt = (
            select(WebAuthnCredential)
            .where(WebAuthnCredential.student_id.isnot(None))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, credential: WebAuthnCredential) -> WebAuthnCredential:
        """Create a new WebAuthn credential."""
        self.session.add(credential)
        await self.session.flush()
        return credential

    async def update_sign_count(self, credential_id: str, new_sign_count: int) -> None:
        """Update the sign count after successful authentication."""
        stmt = (
            update(WebAuthnCredential)
            .where(WebAuthnCredential.credential_id == credential_id)
            .values(sign_count=new_sign_count, last_used_at=datetime.now(timezone.utc))
        )
        await self.session.execute(stmt)

    async def delete(self, credential_id: str) -> bool:
        """Delete a credential by ID. Returns True if deleted, False if not found."""
        credential = await self.get_by_credential_id(credential_id)
        if credential:
            await self.session.delete(credential)
            await self.session.flush()
            return True
        return False

    async def delete_all_for_student(self, student_id: int) -> int:
        """Delete all credentials for a student. Returns count of deleted credentials.

        R7-B2 fix: Use bulk delete instead of N+1 pattern.
        """
        stmt = (
            delete(WebAuthnCredential)
            .where(WebAuthnCredential.student_id == student_id)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def delete_all_for_user(self, user_id: int) -> int:
        """Delete all credentials for a user. Returns count of deleted credentials.

        R7-B2 fix: Use bulk delete instead of N+1 pattern.
        """
        stmt = (
            delete(WebAuthnCredential)
            .where(WebAuthnCredential.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def exists_for_student(self, student_id: int) -> bool:
        """Check if a student has any registered credentials."""
        stmt = (
            select(WebAuthnCredential.credential_id)
            .where(WebAuthnCredential.student_id == student_id)
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def exists_for_user(self, user_id: int) -> bool:
        """Check if a user has any registered credentials."""
        stmt = (
            select(WebAuthnCredential.credential_id)
            .where(WebAuthnCredential.user_id == user_id)
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None
