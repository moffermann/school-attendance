"""Repository for tenant audit logs."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant_audit_log import TenantAuditLog


class TenantAuditLogRepository:
    """Repository for tenant audit log operations."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(
        self,
        tenant_id: int | None,
        action: str,
        admin_id: int | None = None,
        entity: str | None = None,
        entity_id: int | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> TenantAuditLog:
        """Create an audit log entry."""
        log_entry = TenantAuditLog(
            tenant_id=tenant_id,
            super_admin_id=admin_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address,
        )
        self._session.add(log_entry)
        return log_entry

    async def list_by_tenant(
        self,
        tenant_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TenantAuditLog]:
        """List audit logs for a specific tenant."""
        result = await self._session.execute(
            select(TenantAuditLog)
            .where(TenantAuditLog.tenant_id == tenant_id)
            .order_by(TenantAuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def list_by_admin(
        self,
        admin_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TenantAuditLog]:
        """List audit logs for a specific super admin."""
        result = await self._session.execute(
            select(TenantAuditLog)
            .where(TenantAuditLog.super_admin_id == admin_id)
            .order_by(TenantAuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
