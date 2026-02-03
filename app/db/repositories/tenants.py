"""Tenant repository for multi-tenant management."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.tenant import Tenant
from app.db.models.tenant_config import TenantConfig
from app.db.models.tenant_feature import TenantFeature


class TenantRepository:
    """Repository for Tenant CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, tenant_id: int) -> Tenant | None:
        """Get tenant by ID."""
        return await self.session.get(Tenant, tenant_id)

    async def get_with_relations(self, tenant_id: int) -> Tenant | None:
        """Get tenant with features and config loaded."""
        stmt = (
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(
                selectinload(Tenant.features),
                selectinload(Tenant.tenant_config),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Tenant | None:
        """Get tenant by slug."""
        stmt = select(Tenant).where(Tenant.slug == slug)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_domain(self, domain: str) -> Tenant | None:
        """Get tenant by custom domain."""
        stmt = select(Tenant).where(Tenant.domain == domain, Tenant.is_active == True)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_subdomain(self, subdomain: str) -> Tenant | None:
        """Get tenant by subdomain."""
        stmt = select(Tenant).where(Tenant.subdomain == subdomain, Tenant.is_active == True)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, include_inactive: bool = False) -> list[Tenant]:
        """List all tenants."""
        stmt = select(Tenant).order_by(Tenant.name)
        if not include_inactive:
            stmt = stmt.where(Tenant.is_active == True)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, include_inactive: bool = False) -> int:
        """Count total tenants."""
        stmt = select(func.count(Tenant.id))
        if not include_inactive:
            stmt = stmt.where(Tenant.is_active == True)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def create(
        self,
        *,
        slug: str,
        name: str,
        subdomain: str | None = None,
        domain: str | None = None,
        plan: str = "standard",
        max_students: int = 500,
    ) -> Tenant:
        """Create a new tenant."""
        tenant = Tenant(
            slug=slug,
            name=name,
            subdomain=subdomain,
            domain=domain,
            plan=plan,
            max_students=max_students,
            is_active=True,
        )
        self.session.add(tenant)
        await self.session.flush()
        return tenant

    async def update(
        self,
        tenant_id: int,
        *,
        name: str | None = None,
        subdomain: str | None = None,
        domain: str | None = None,
        plan: str | None = None,
        max_students: int | None = None,
        is_active: bool | None = None,
        config: dict[str, Any] | None = None,
    ) -> Tenant | None:
        """Update tenant fields."""
        tenant = await self.get(tenant_id)
        if not tenant:
            return None

        if name is not None:
            tenant.name = name
        if subdomain is not None:
            tenant.subdomain = subdomain
        if domain is not None:
            tenant.domain = domain
        if plan is not None:
            tenant.plan = plan
        if max_students is not None:
            tenant.max_students = max_students
        if is_active is not None:
            tenant.is_active = is_active
        if config is not None:
            tenant.config = config

        await self.session.flush()
        return tenant

    async def deactivate(self, tenant_id: int) -> Tenant | None:
        """Deactivate a tenant."""
        return await self.update(tenant_id, is_active=False)

    async def activate(self, tenant_id: int) -> Tenant | None:
        """Activate a tenant."""
        return await self.update(tenant_id, is_active=True)

    async def slug_exists(self, slug: str) -> bool:
        """Check if a slug is already in use."""
        stmt = select(func.count(Tenant.id)).where(Tenant.slug == slug)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0

    async def subdomain_exists(self, subdomain: str, exclude_tenant_id: int | None = None) -> bool:
        """Check if a subdomain is already in use."""
        stmt = select(func.count(Tenant.id)).where(Tenant.subdomain == subdomain)
        if exclude_tenant_id:
            stmt = stmt.where(Tenant.id != exclude_tenant_id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0

    async def domain_exists(self, domain: str, exclude_tenant_id: int | None = None) -> bool:
        """Check if a domain is already in use."""
        stmt = select(func.count(Tenant.id)).where(Tenant.domain == domain)
        if exclude_tenant_id:
            stmt = stmt.where(Tenant.id != exclude_tenant_id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0
