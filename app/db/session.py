"""Database session and engine configuration for multi-tenant support."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant


# TDD-R3-BUG3 fix: Add connection pool configuration for production stability
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_size=20,          # Default connections in pool
    max_overflow=10,       # Extra connections when pool exhausted
    pool_pre_ping=True,    # Verify connection before use (detect stale)
    pool_recycle=3600,     # Recycle connections after 1 hour
)

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session with public schema (for super admin or backwards compatibility)."""
    async with async_session() as session:
        yield session


async def get_tenant_session(schema_name: str) -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session with search_path set to tenant schema.

    The connection executes:
    SET search_path TO tenant_<slug>, public;

    This ensures all unqualified table references go to tenant schema,
    while public schema tables remain accessible.

    Args:
        schema_name: The tenant schema name (e.g., 'tenant_colegio_abc')

    Yields:
        AsyncSession with search_path configured for the tenant
    """
    async with async_session() as session:
        # Set schema search path for this connection
        await session.execute(text(f"SET search_path TO {schema_name}, public"))
        try:
            yield session
        finally:
            # Reset to default on connection return to pool
            await session.execute(text("SET search_path TO public"))


async def get_session_for_tenant(tenant: "Tenant") -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session for a specific tenant.

    Args:
        tenant: The Tenant model instance

    Yields:
        AsyncSession with search_path configured for the tenant
    """
    schema_name = f"tenant_{tenant.slug}"
    async for session in get_tenant_session(schema_name):
        yield session


async def create_tenant_schema(schema_name: str) -> None:
    """
    Create a new PostgreSQL schema for a tenant.

    Args:
        schema_name: The schema name to create (e.g., 'tenant_colegio_abc')
    """
    # Validate schema name to prevent SQL injection
    if not schema_name.replace("_", "").isalnum():
        raise ValueError(f"Invalid schema name: {schema_name}")

    async with async_session() as session:
        await session.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        await session.commit()


async def drop_tenant_schema(schema_name: str, cascade: bool = False) -> None:
    """
    Drop a tenant's PostgreSQL schema.

    Args:
        schema_name: The schema name to drop
        cascade: If True, drops all objects in the schema too
    """
    # Validate schema name to prevent SQL injection
    if not schema_name.replace("_", "").isalnum():
        raise ValueError(f"Invalid schema name: {schema_name}")

    cascade_clause = "CASCADE" if cascade else "RESTRICT"
    async with async_session() as session:
        await session.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} {cascade_clause}"))
        await session.commit()


async def schema_exists(schema_name: str) -> bool:
    """
    Check if a schema exists in the database.

    Args:
        schema_name: The schema name to check

    Returns:
        True if schema exists, False otherwise
    """
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema)"
            ),
            {"schema": schema_name},
        )
        row = result.scalar()
        return bool(row)
