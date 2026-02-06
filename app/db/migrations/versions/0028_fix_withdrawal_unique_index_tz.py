"""Fix withdrawal unique constraint to use local timezone instead of UTC.

The previous index used `AT TIME ZONE 'UTC'` to extract the date from
initiated_at. This caused false constraint violations when:
- A withdrawal at 22:00 Chile time (01:00 UTC next day) and
- A withdrawal at 10:00 Chile time (13:00 UTC same day)
would both resolve to the same UTC date, even though they are on
different LOCAL days.

This migration:
1. Drops the old UTC-based unique index
2. Creates a new partial unique index using America/Santiago timezone
3. Cancels any stale INITIATED/VERIFIED withdrawals (older than 24h)
4. Syncs the index to all tenant schemas

Revision ID: 0028_fix_withdrawal_tz
Revises: 0027_fix_authorized_pickups_fk
Create Date: 2026-02-05
"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from alembic import op

revision = "0028_fix_withdrawal_tz"
down_revision = "0027_fix_authorized_pickups_fk"
branch_labels = None
depends_on = None

logger = logging.getLogger(__name__)

# The old index might have different names depending on how it was created
OLD_INDEX_NAMES = [
    "uq_withdrawal_student_date_completed",
    "student_withdrawals_student_id_timezone_idx",
]

NEW_INDEX_NAME = "uq_withdrawal_student_localdate_completed"

# Use local timezone for date extraction (Chile standard)
NEW_INDEX_SQL = (
    f"CREATE UNIQUE INDEX {NEW_INDEX_NAME} "
    "ON student_withdrawals (student_id, CAST(initiated_at AT TIME ZONE 'America/Santiago' AS date)) "
    "WHERE status = 'COMPLETED'"
)


def upgrade() -> None:
    """Fix the unique constraint to use local timezone."""
    conn = op.get_bind()

    # 1. Drop old index(es) from public schema
    for idx_name in OLD_INDEX_NAMES:
        try:
            op.execute(f"DROP INDEX IF EXISTS {idx_name}")
            logger.info(f"Dropped index {idx_name} from public schema")
        except Exception as e:
            logger.warning(f"Could not drop index {idx_name}: {e}")

    # 2. Create new index with local timezone in public schema
    op.execute(NEW_INDEX_SQL)
    logger.info(f"Created new index {NEW_INDEX_NAME} with America/Santiago timezone")

    # 3. Cancel stale INITIATED/VERIFIED withdrawals (older than 24 hours)
    # These are orphaned records from failed flows
    result = conn.execute(
        sa.text("""
            UPDATE student_withdrawals
            SET status = 'CANCELLED',
                cancellation_reason = 'Auto-cancelado: flujo incompleto después de 24 horas',
                cancelled_at = NOW()
            WHERE status IN ('INITIATED', 'VERIFIED')
            AND initiated_at < NOW() - INTERVAL '24 hours'
        """)
    )
    cancelled_count = result.rowcount
    if cancelled_count > 0:
        logger.info(f"Auto-cancelled {cancelled_count} stale withdrawal records in public schema")

    # 4. Sync to all tenant schemas
    result = conn.execute(
        sa.text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
        """)
    )
    tenant_schemas = [row[0] for row in result.fetchall()]

    for schema_name in tenant_schemas:
        # Check if student_withdrawals exists in this schema
        exists_result = conn.execute(
            sa.text("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = :schema
                    AND table_name = 'student_withdrawals'
                )
            """),
            {"schema": schema_name},
        )
        if not exists_result.scalar():
            continue

        # Drop old indexes
        for idx_name in OLD_INDEX_NAMES:
            try:
                conn.execute(sa.text(f"DROP INDEX IF EXISTS {schema_name}.{idx_name}"))
            except Exception:
                pass

        # Create new index
        try:
            tenant_index_sql = (
                f"CREATE UNIQUE INDEX {NEW_INDEX_NAME} "
                f"ON {schema_name}.student_withdrawals "
                f"(student_id, CAST(initiated_at AT TIME ZONE 'America/Santiago' AS date)) "
                f"WHERE status = 'COMPLETED'"
            )
            conn.execute(sa.text(tenant_index_sql))
            logger.info(f"Created {NEW_INDEX_NAME} in {schema_name}")
        except Exception as e:
            logger.warning(f"Could not create index in {schema_name}: {e}")

        # Cancel stale records in tenant schema
        try:
            conn.execute(
                sa.text(f"""
                    UPDATE {schema_name}.student_withdrawals
                    SET status = 'CANCELLED',
                        cancellation_reason = 'Auto-cancelado: flujo incompleto después de 24 horas',
                        cancelled_at = NOW()
                    WHERE status IN ('INITIATED', 'VERIFIED')
                    AND initiated_at < NOW() - INTERVAL '24 hours'
                """)
            )
        except Exception as e:
            logger.warning(f"Could not cancel stale records in {schema_name}: {e}")

    logger.info(f"Migration complete. Synced to {len(tenant_schemas)} tenant schemas.")


def downgrade() -> None:
    """Restore the old UTC-based unique index."""
    conn = op.get_bind()

    # Drop new index
    op.execute(f"DROP INDEX IF EXISTS {NEW_INDEX_NAME}")

    # Restore old index with UTC timezone
    op.execute(
        "CREATE UNIQUE INDEX uq_withdrawal_student_date_completed "
        "ON student_withdrawals (student_id, CAST(initiated_at AT TIME ZONE 'UTC' AS date)) "
        "WHERE status = 'COMPLETED'"
    )

    # Sync to tenant schemas
    result = conn.execute(
        sa.text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
        """)
    )
    for row in result.fetchall():
        schema_name = row[0]
        try:
            conn.execute(sa.text(f"DROP INDEX IF EXISTS {schema_name}.{NEW_INDEX_NAME}"))
            conn.execute(
                sa.text(
                    f"CREATE UNIQUE INDEX uq_withdrawal_student_date_completed "
                    f"ON {schema_name}.student_withdrawals "
                    f"(student_id, CAST(initiated_at AT TIME ZONE 'UTC' AS date)) "
                    f"WHERE status = 'COMPLETED'"
                )
            )
        except Exception:
            pass
