#!/usr/bin/env python3
"""
Migration script to convert existing single-tenant data to multi-tenant architecture.

This script:
1. Creates a super admin account
2. Creates the first tenant from existing data
3. Creates the tenant schema and moves all data
4. Sets up feature flags and configuration

Usage:
    python scripts/migrate_to_multi_tenant.py --tenant-name "Colegio Demo" --tenant-slug "demo" \
        --admin-email "admin@demo.cl" --super-admin-email "super@example.com"

Requirements:
    - Database should have the multi-tenant migrations applied (0009_multi_tenant_public_schema.py)
    - Existing data should be in the public schema
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import get_engine, async_session
from app.db.models.tenant import Tenant
from app.db.models.super_admin import SuperAdmin
from app.db.models.tenant_feature import TenantFeature
from app.db.models.tenant_config import TenantConfig
from app.db.repositories.tenant_features import TenantFeatureRepository


# Tables to migrate to tenant schema
TABLES_TO_MIGRATE = [
    "users",
    "students",
    "guardians",
    "teachers",
    "courses",
    "enrollments",
    "schedules",
    "schedule_exceptions",
    "attendance_events",
    "devices",
    "tags",
    "notifications",
    "broadcast_messages",
    "guardian_notification_preferences",
    "webauthn_credentials",
    "absence_requests",
    "alerts",
]


async def create_super_admin(session: AsyncSession, email: str, password: str, name: str) -> SuperAdmin:
    """Create the initial super admin account."""
    print(f"Creating super admin: {email}")

    # Check if already exists
    result = await session.execute(
        text("SELECT id FROM super_admins WHERE email = :email"),
        {"email": email}
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"  Super admin {email} already exists (id={existing})")
        return await session.get(SuperAdmin, existing)

    admin = SuperAdmin(
        email=email,
        full_name=name,
        hashed_password=get_password_hash(password),
        is_active=True,
    )
    session.add(admin)
    await session.flush()
    print(f"  Created super admin with id={admin.id}")
    return admin


async def create_tenant(
    session: AsyncSession,
    name: str,
    slug: str,
    admin_email: str,
    domain: str | None = None,
) -> Tenant:
    """Create the tenant record."""
    print(f"Creating tenant: {name} (slug={slug})")

    # Check if already exists
    result = await session.execute(
        text("SELECT id FROM tenants WHERE slug = :slug"),
        {"slug": slug}
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"  Tenant {slug} already exists (id={existing})")
        return await session.get(Tenant, existing)

    tenant = Tenant(
        name=name,
        slug=slug,
        domain=domain,
        subdomain=slug,
        is_active=True,
        plan="pro",  # Give migrated tenant pro plan
        max_students=1000,
        admin_email=admin_email,
    )
    session.add(tenant)
    await session.flush()
    print(f"  Created tenant with id={tenant.id}")
    return tenant


async def create_tenant_schema(session: AsyncSession, schema_name: str) -> None:
    """Create the PostgreSQL schema for the tenant."""
    print(f"Creating schema: {schema_name}")

    # Check if schema exists
    result = await session.execute(
        text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
        {"name": schema_name}
    )
    if result.scalar_one_or_none():
        print(f"  Schema {schema_name} already exists")
        return

    await session.execute(text(f'CREATE SCHEMA "{schema_name}"'))
    print(f"  Schema {schema_name} created")


async def copy_table_to_schema(
    session: AsyncSession,
    table_name: str,
    source_schema: str,
    target_schema: str,
) -> int:
    """Copy a table's structure and data to the new schema."""
    print(f"  Copying table: {table_name}")

    # Check if source table exists
    result = await session.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = :schema AND table_name = :table
            )
        """),
        {"schema": source_schema, "table": table_name}
    )
    if not result.scalar():
        print(f"    Table {table_name} does not exist in {source_schema}, skipping")
        return 0

    # Check if target table already exists
    result = await session.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = :schema AND table_name = :table
            )
        """),
        {"schema": target_schema, "table": table_name}
    )
    if result.scalar():
        print(f"    Table {table_name} already exists in {target_schema}, skipping")
        return 0

    # Create table structure in new schema (including indexes and constraints)
    await session.execute(text(f"""
        CREATE TABLE "{target_schema}"."{table_name}"
        (LIKE "{source_schema}"."{table_name}" INCLUDING ALL)
    """))

    # Copy data
    result = await session.execute(text(f"""
        INSERT INTO "{target_schema}"."{table_name}"
        SELECT * FROM "{source_schema}"."{table_name}"
    """))

    row_count = result.rowcount
    print(f"    Copied {row_count} rows")
    return row_count


async def migrate_data_to_tenant(
    session: AsyncSession,
    tenant_slug: str,
) -> dict:
    """Migrate all data from public schema to tenant schema."""
    schema_name = f"tenant_{tenant_slug}"
    stats = {"tables": 0, "rows": 0}

    print(f"Migrating data to schema: {schema_name}")

    for table in TABLES_TO_MIGRATE:
        try:
            rows = await copy_table_to_schema(session, table, "public", schema_name)
            if rows > 0:
                stats["tables"] += 1
                stats["rows"] += rows
        except Exception as e:
            print(f"    Error copying {table}: {e}")
            # Continue with other tables

    return stats


async def setup_tenant_features(session: AsyncSession, tenant_id: int) -> None:
    """Initialize feature flags for the tenant."""
    print(f"Setting up feature flags for tenant {tenant_id}")

    repo = TenantFeatureRepository(session)
    await repo.initialize_features(tenant_id)

    # Enable all features for migrated tenant
    for feature in TenantFeature.ALL_FEATURES:
        await repo.set_enabled(tenant_id, feature, True)

    print(f"  Enabled {len(TenantFeature.ALL_FEATURES)} features")


async def setup_tenant_config(session: AsyncSession, tenant_id: int) -> None:
    """Create tenant configuration with defaults."""
    print(f"Setting up configuration for tenant {tenant_id}")

    # Check if config exists
    result = await session.execute(
        text("SELECT tenant_id FROM tenant_configs WHERE tenant_id = :id"),
        {"id": tenant_id}
    )
    if result.scalar_one_or_none():
        print("  Config already exists")
        return

    config = TenantConfig(
        tenant_id=tenant_id,
        ses_region="us-east-1",
    )
    session.add(config)
    await session.flush()
    print("  Config created with defaults")


async def update_existing_admin_user(
    session: AsyncSession,
    tenant_slug: str,
    admin_email: str,
) -> None:
    """Mark the existing admin user in the tenant schema."""
    schema_name = f"tenant_{tenant_slug}"
    print(f"Updating admin user in {schema_name}")

    # Find existing admin/director user
    result = await session.execute(text(f"""
        SELECT id, email FROM "{schema_name}".users
        WHERE role IN ('ADMIN', 'DIRECTOR')
        LIMIT 1
    """))
    row = result.first()

    if row:
        print(f"  Found existing admin: {row.email} (id={row.id})")
    else:
        print(f"  No existing admin found, will need to create one with email: {admin_email}")


async def run_migration(
    tenant_name: str,
    tenant_slug: str,
    admin_email: str,
    super_admin_email: str,
    super_admin_password: str,
    super_admin_name: str,
    domain: str | None = None,
    dry_run: bool = False,
) -> None:
    """Run the full migration process."""
    print("=" * 60)
    print("Multi-Tenant Migration Script")
    print("=" * 60)
    print(f"Tenant Name: {tenant_name}")
    print(f"Tenant Slug: {tenant_slug}")
    print(f"Admin Email: {admin_email}")
    print(f"Super Admin: {super_admin_email}")
    print(f"Dry Run: {dry_run}")
    print("=" * 60)

    if dry_run:
        print("\n*** DRY RUN - No changes will be made ***\n")
        return

    async with async_session() as session:
        try:
            # Step 1: Create super admin
            await create_super_admin(
                session,
                email=super_admin_email,
                password=super_admin_password,
                name=super_admin_name,
            )

            # Step 2: Create tenant
            tenant = await create_tenant(
                session,
                name=tenant_name,
                slug=tenant_slug,
                admin_email=admin_email,
                domain=domain,
            )

            # Step 3: Create tenant schema
            schema_name = f"tenant_{tenant_slug}"
            await create_tenant_schema(session, schema_name)

            # Step 4: Migrate data
            stats = await migrate_data_to_tenant(session, tenant_slug)

            # Step 5: Setup features
            await setup_tenant_features(session, tenant.id)

            # Step 6: Setup config
            await setup_tenant_config(session, tenant.id)

            # Step 7: Update admin user reference
            await update_existing_admin_user(session, tenant_slug, admin_email)

            # Commit all changes
            await session.commit()

            print("\n" + "=" * 60)
            print("Migration completed successfully!")
            print("=" * 60)
            print(f"Tables migrated: {stats['tables']}")
            print(f"Total rows: {stats['rows']}")
            print(f"\nNext steps:")
            print(f"  1. Login as super admin at /super-admin/auth")
            print(f"  2. Configure WhatsApp/SES credentials for the tenant")
            print(f"  3. Verify tenant access at {domain or f'{tenant_slug}.yourdomain.com'}")

        except Exception as e:
            await session.rollback()
            print(f"\nError during migration: {e}")
            raise


def main():
    parser = argparse.ArgumentParser(
        description="Migrate existing data to multi-tenant architecture"
    )
    parser.add_argument(
        "--tenant-name",
        required=True,
        help="Name of the tenant (e.g., 'Colegio San José')",
    )
    parser.add_argument(
        "--tenant-slug",
        required=True,
        help="Slug for the tenant (e.g., 'san-jose')",
    )
    parser.add_argument(
        "--admin-email",
        required=True,
        help="Email for the tenant administrator",
    )
    parser.add_argument(
        "--domain",
        default=None,
        help="Custom domain for the tenant (optional)",
    )
    parser.add_argument(
        "--super-admin-email",
        required=True,
        help="Email for the super admin account",
    )
    parser.add_argument(
        "--super-admin-name",
        default="Super Admin",
        help="Name for the super admin account",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()

    # Get super admin password securely
    if not args.dry_run:
        print("Enter password for super admin account:")
        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Confirm password: ")

        if password != password_confirm:
            print("Passwords do not match!")
            sys.exit(1)

        if len(password) < 8:
            print("Password must be at least 8 characters!")
            sys.exit(1)
    else:
        password = "dummy"

    # Run migration
    asyncio.run(run_migration(
        tenant_name=args.tenant_name,
        tenant_slug=args.tenant_slug,
        admin_email=args.admin_email,
        super_admin_email=args.super_admin_email,
        super_admin_password=password,
        super_admin_name=args.super_admin_name,
        domain=args.domain,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
