"""Super Admin repository for multi-tenant platform administration."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.super_admin import SuperAdmin


class SuperAdminRepository:
    """Repository for SuperAdmin CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, admin_id: int) -> SuperAdmin | None:
        """Get super admin by ID."""
        return await self.session.get(SuperAdmin, admin_id)

    async def get_by_email(self, email: str) -> SuperAdmin | None:
        """Get super admin by email."""
        stmt = select(SuperAdmin).where(SuperAdmin.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, include_inactive: bool = False) -> list[SuperAdmin]:
        """List all super admins."""
        stmt = select(SuperAdmin).order_by(SuperAdmin.email)
        if not include_inactive:
            stmt = stmt.where(SuperAdmin.is_active == True)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        email: str,
        full_name: str,
        hashed_password: str,
    ) -> SuperAdmin:
        """Create a new super admin."""
        admin = SuperAdmin(
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            is_active=True,
        )
        self.session.add(admin)
        await self.session.flush()
        return admin

    async def update_password(self, admin_id: int, hashed_password: str) -> SuperAdmin | None:
        """Update super admin password."""
        admin = await self.get(admin_id)
        if admin:
            admin.hashed_password = hashed_password
            await self.session.flush()
        return admin

    async def update_last_login(self, admin_id: int) -> SuperAdmin | None:
        """Update last login timestamp."""
        admin = await self.get(admin_id)
        if admin:
            admin.last_login_at = datetime.now(timezone.utc)
            await self.session.flush()
        return admin

    async def deactivate(self, admin_id: int) -> SuperAdmin | None:
        """Deactivate a super admin."""
        admin = await self.get(admin_id)
        if admin:
            admin.is_active = False
            await self.session.flush()
        return admin

    async def activate(self, admin_id: int) -> SuperAdmin | None:
        """Activate a super admin."""
        admin = await self.get(admin_id)
        if admin:
            admin.is_active = True
            await self.session.flush()
        return admin
