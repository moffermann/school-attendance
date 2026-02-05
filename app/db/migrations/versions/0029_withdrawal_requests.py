"""Create withdrawal_requests table for parent-initiated pickup scheduling.

Parents can request a withdrawal in advance, school staff reviews it,
and when the actual withdrawal happens, the system auto-links them.

Revision ID: 0029_withdrawal_requests
Revises: 0028_fix_withdrawal_tz
Create Date: 2026-02-05
"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from alembic import op

revision = "0029_withdrawal_requests"
down_revision = "0028_fix_withdrawal_tz"
branch_labels = None
depends_on = None

logger = logging.getLogger(__name__)

TABLE_NAME = "withdrawal_requests"


def upgrade() -> None:
    """Create withdrawal_requests table and sync to tenant schemas."""
    conn = op.get_bind()

    # 1. Create table in public schema
    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("authorized_pickup_id", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="PENDING"
        ),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_time", sa.Time(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requested_by_guardian_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "reviewed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("review_notes", sa.String(500), nullable=True),
        sa.Column("student_withdrawal_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(
            ["authorized_pickup_id"], ["authorized_pickups.id"]
        ),
        sa.ForeignKeyConstraint(
            ["requested_by_guardian_id"], ["guardians.id"]
        ),
        sa.ForeignKeyConstraint(
            ["student_withdrawal_id"], ["student_withdrawals.id"]
        ),
    )

    # 2. Individual indexes
    op.create_index("ix_wr_student_id", TABLE_NAME, ["student_id"])
    op.create_index("ix_wr_scheduled_date", TABLE_NAME, ["scheduled_date"])
    op.create_index("ix_wr_status", TABLE_NAME, ["status"])
    op.create_index(
        "ix_wr_guardian_id", TABLE_NAME, ["requested_by_guardian_id"]
    )
    op.create_index(
        "ix_wr_pickup_id", TABLE_NAME, ["authorized_pickup_id"]
    )

    # 3. Composite index for kiosk cross-reference lookup
    op.create_index(
        "ix_wr_student_date_status",
        TABLE_NAME,
        ["student_id", "scheduled_date", "status"],
    )

    logger.info("Created withdrawal_requests table in public schema")

    # 4. Sync to tenant schemas
    result = conn.execute(
        sa.text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
        """)
    )
    tenant_schemas = [row[0] for row in result.fetchall()]

    for schema_name in tenant_schemas:
        try:
            # Check if required tables exist in this schema
            exists_result = conn.execute(
                sa.text("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = :schema
                        AND table_name = 'students'
                    )
                """),
                {"schema": schema_name},
            )
            if not exists_result.scalar():
                logger.warning(
                    f"Skipping {schema_name}: students table not found"
                )
                continue

            # Create table in tenant schema
            conn.execute(
                sa.text(f"""
                    CREATE TABLE {schema_name}.{TABLE_NAME} (
                        id SERIAL PRIMARY KEY,
                        student_id INTEGER NOT NULL
                            REFERENCES {schema_name}.students(id),
                        authorized_pickup_id INTEGER NOT NULL
                            REFERENCES {schema_name}.authorized_pickups(id),
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        scheduled_date DATE NOT NULL,
                        scheduled_time TIME,
                        reason TEXT,
                        requested_by_guardian_id INTEGER NOT NULL
                            REFERENCES {schema_name}.guardians(id),
                        requested_by_user_id INTEGER NOT NULL,
                        reviewed_by_user_id INTEGER,
                        reviewed_at TIMESTAMPTZ,
                        review_notes VARCHAR(500),
                        student_withdrawal_id INTEGER
                            REFERENCES {schema_name}.student_withdrawals(id),
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        cancelled_at TIMESTAMPTZ
                    )
                """)
            )

            # Create indexes in tenant schema
            for idx_name, columns in [
                ("ix_wr_student_id", "student_id"),
                ("ix_wr_scheduled_date", "scheduled_date"),
                ("ix_wr_status", "status"),
                ("ix_wr_guardian_id", "requested_by_guardian_id"),
                ("ix_wr_pickup_id", "authorized_pickup_id"),
            ]:
                conn.execute(
                    sa.text(
                        f"CREATE INDEX {idx_name} ON "
                        f"{schema_name}.{TABLE_NAME} ({columns})"
                    )
                )

            # Composite index
            conn.execute(
                sa.text(
                    f"CREATE INDEX ix_wr_student_date_status ON "
                    f"{schema_name}.{TABLE_NAME} "
                    f"(student_id, scheduled_date, status)"
                )
            )

            logger.info(f"Created {TABLE_NAME} in {schema_name}")
        except Exception as e:
            logger.warning(
                f"Could not create {TABLE_NAME} in {schema_name}: {e}"
            )

    logger.info(
        f"Migration complete. Synced to {len(tenant_schemas)} tenant schemas."
    )


def downgrade() -> None:
    """Drop withdrawal_requests table from all schemas."""
    conn = op.get_bind()

    # Drop from tenant schemas first
    result = conn.execute(
        sa.text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
        """)
    )
    for row in result.fetchall():
        schema_name = row[0]
        try:
            conn.execute(
                sa.text(f"DROP TABLE IF EXISTS {schema_name}.{TABLE_NAME}")
            )
        except Exception:
            pass

    # Drop from public schema
    op.drop_table(TABLE_NAME)
