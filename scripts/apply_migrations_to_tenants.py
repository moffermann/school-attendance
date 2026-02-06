#!/usr/bin/env python3
"""
Apply recent migrations to all tenant schemas.

This script applies the following migrations to existing tenant schemas:
- 0021: Add conflict_corrected to attendance_events
- 0022: Add notification_date and context_id to notifications
- 0023: Create sequence_corrections table
- 0024: Add timezone column to tenant_configs (public schema only)

Usage:
    python scripts/apply_migrations_to_tenants.py
    python scripts/apply_migrations_to_tenants.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session


async def get_tenant_schemas(session: AsyncSession) -> list[str]:
    """Get all tenant schema names from database."""
    result = await session.execute(text("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
    """))
    return [row[0] for row in result.fetchall()]


async def check_column_exists(
    session: AsyncSession,
    schema: str,
    table: str,
    column: str
) -> bool:
    """Check if a column exists in a table."""
    result = await session.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = :schema
            AND table_name = :table
            AND column_name = :column
        )
    """), {"schema": schema, "table": table, "column": column})
    return result.scalar()


async def check_table_exists(
    session: AsyncSession,
    schema: str,
    table: str
) -> bool:
    """Check if a table exists in a schema."""
    result = await session.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema
            AND table_name = :table
        )
    """), {"schema": schema, "table": table})
    return result.scalar()


async def check_index_exists(
    session: AsyncSession,
    schema: str,
    index_name: str
) -> bool:
    """Check if an index exists in a schema."""
    result = await session.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = :schema
            AND indexname = :index_name
        )
    """), {"schema": schema, "index_name": index_name})
    return result.scalar()


async def apply_migration_0021(session: AsyncSession, schema: str, dry_run: bool) -> bool:
    """Add conflict_corrected column to attendance_events."""
    table = "attendance_events"
    column = "conflict_corrected"

    if not await check_table_exists(session, schema, table):
        print(f"    [SKIP] Table {table} does not exist")
        return False

    if await check_column_exists(session, schema, table, column):
        print(f"    [SKIP] Column {column} already exists")
        return False

    if dry_run:
        print(f"    [DRY] Would add column {column} to {table}")
        return True

    await session.execute(text(f"""
        ALTER TABLE "{schema}"."{table}"
        ADD COLUMN {column} BOOLEAN NOT NULL DEFAULT FALSE
    """))
    print(f"    [OK] Added column {column} to {table}")
    return True


async def apply_migration_0022(session: AsyncSession, schema: str, dry_run: bool) -> bool:
    """Add notification_date and context_id to notifications, plus unique index."""
    table = "notifications"
    changes_made = False

    if not await check_table_exists(session, schema, table):
        print(f"    [SKIP] Table {table} does not exist")
        return False

    # Add notification_date column
    if not await check_column_exists(session, schema, table, "notification_date"):
        if dry_run:
            print(f"    [DRY] Would add column notification_date to {table}")
        else:
            await session.execute(text(f"""
                ALTER TABLE "{schema}"."{table}"
                ADD COLUMN notification_date DATE
            """))
            # Populate from ts_created
            await session.execute(text(f"""
                UPDATE "{schema}"."{table}"
                SET notification_date = DATE(ts_created)
                WHERE notification_date IS NULL
            """))
            # Make NOT NULL
            await session.execute(text(f"""
                ALTER TABLE "{schema}"."{table}"
                ALTER COLUMN notification_date SET NOT NULL
            """))
            print(f"    [OK] Added column notification_date to {table}")
        changes_made = True
    else:
        print(f"    [SKIP] Column notification_date already exists")

    # Add context_id column
    if not await check_column_exists(session, schema, table, "context_id"):
        if dry_run:
            print(f"    [DRY] Would add column context_id to {table}")
        else:
            await session.execute(text(f"""
                ALTER TABLE "{schema}"."{table}"
                ADD COLUMN context_id INTEGER
            """))
            # Populate from payload->student_id where applicable
            await session.execute(text(f"""
                UPDATE "{schema}"."{table}"
                SET context_id = CASE
                    WHEN payload->>'student_id' ~ '^[0-9]+(\\.0+)?$'
                    THEN FLOOR((payload->>'student_id')::numeric)::integer
                    ELSE NULL
                END
                WHERE context_id IS NULL
                  AND payload->>'student_id' IS NOT NULL
                  AND payload->>'student_id' ~ '^[0-9]+(\\.0+)?$'
            """))
            print(f"    [OK] Added column context_id to {table}")
        changes_made = True
    else:
        print(f"    [SKIP] Column context_id already exists")

    # Add unique index for deduplication
    index_name = "ix_notifications_dedup"
    if not await check_index_exists(session, schema, index_name):
        if dry_run:
            print(f"    [DRY] Would create index {index_name}")
        else:
            # First, remove duplicates keeping only the most recent notification
            # Find and delete duplicates for INGRESO_OK/SALIDA_OK templates
            result = await session.execute(text(f"""
                WITH duplicates AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY guardian_id, channel, template, context_id, notification_date
                               ORDER BY ts_created DESC
                           ) as rn
                    FROM "{schema}"."{table}"
                    WHERE template IN ('INGRESO_OK', 'SALIDA_OK')
                      AND context_id IS NOT NULL
                )
                DELETE FROM "{schema}"."{table}"
                WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
            """))
            deleted_count = result.rowcount
            if deleted_count > 0:
                print(f"    [CLEAN] Removed {deleted_count} duplicate notifications")

            await session.execute(text(f"""
                CREATE UNIQUE INDEX {index_name}
                ON "{schema}"."{table}" (guardian_id, channel, template, context_id, notification_date)
                WHERE template IN ('INGRESO_OK', 'SALIDA_OK') AND context_id IS NOT NULL
            """))
            print(f"    [OK] Created index {index_name}")
        changes_made = True
    else:
        print(f"    [SKIP] Index {index_name} already exists")

    return changes_made


async def apply_migration_0023(session: AsyncSession, schema: str, dry_run: bool) -> bool:
    """Create sequence_corrections table."""
    table = "sequence_corrections"

    if await check_table_exists(session, schema, table):
        print(f"    [SKIP] Table {table} already exists")
        return False

    if dry_run:
        print(f"    [DRY] Would create table {table}")
        return True

    await session.execute(text(f"""
        CREATE TABLE "{schema}"."{table}" (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            requested_type VARCHAR(10) NOT NULL,
            corrected_type VARCHAR(10) NOT NULL,
            device_id VARCHAR(64) NOT NULL,
            gate_id VARCHAR(64) NOT NULL,
            occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
            corrected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_sequence_corrections_event
                FOREIGN KEY (event_id) REFERENCES "{schema}".attendance_events(id),
            CONSTRAINT fk_sequence_corrections_student
                FOREIGN KEY (student_id) REFERENCES "{schema}".students(id)
        )
    """))

    # Create indexes
    await session.execute(text(f"""
        CREATE INDEX ix_sequence_corrections_event_id ON "{schema}"."{table}" (event_id)
    """))
    await session.execute(text(f"""
        CREATE INDEX ix_sequence_corrections_student_id ON "{schema}"."{table}" (student_id)
    """))
    await session.execute(text(f"""
        CREATE INDEX ix_sequence_corrections_device_id ON "{schema}"."{table}" (device_id)
    """))
    await session.execute(text(f"""
        CREATE INDEX ix_sequence_corrections_corrected_at ON "{schema}"."{table}" (corrected_at)
    """))

    print(f"    [OK] Created table {table} with indexes")
    return True


async def apply_migrations(dry_run: bool = False) -> None:
    """Apply all pending migrations to all tenant schemas."""
    print("=" * 60)
    print("Apply Migrations to Tenant Schemas")
    print("=" * 60)
    print(f"Dry Run: {dry_run}")
    print("=" * 60)

    async with async_session() as session:
        # Get all tenant schemas
        schemas = await get_tenant_schemas(session)

        if not schemas:
            print("\nNo tenant schemas found!")
            return

        print(f"\nFound {len(schemas)} tenant schema(s): {', '.join(schemas)}")

        total_changes = 0

        for schema in schemas:
            print(f"\n--- Processing {schema} ---")

            # Apply each migration
            print("  Migration 0021 (conflict_corrected):")
            if await apply_migration_0021(session, schema, dry_run):
                total_changes += 1

            print("  Migration 0022 (notification dedup):")
            if await apply_migration_0022(session, schema, dry_run):
                total_changes += 1

            print("  Migration 0023 (sequence_corrections):")
            if await apply_migration_0023(session, schema, dry_run):
                total_changes += 1

        if not dry_run:
            await session.commit()
            print(f"\n{'=' * 60}")
            print(f"Committed {total_changes} change(s) across {len(schemas)} schema(s)")
        else:
            print(f"\n{'=' * 60}")
            print(f"Dry run complete. Would make {total_changes} change(s)")

        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Apply recent migrations to all tenant schemas"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()
    asyncio.run(apply_migrations(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
