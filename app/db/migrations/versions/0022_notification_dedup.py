"""Add deduplication fields to notifications table.

Revision ID: 0022_notification_dedup
Revises: 0021_add_conflict_corrected
Create Date: 2026-02-03

Adds notification_date and context_id for deduplication.
Creates partial unique index to ensure max 1 notification
per guardian/channel/template/student/day for attendance notifications.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_notification_dedup"
down_revision = "0021_add_conflict_corrected"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add deduplication fields and partial unique index."""
    # 1. Add notification_date column (nullable initially)
    op.add_column(
        "notifications",
        sa.Column("notification_date", sa.Date(), nullable=True),
    )

    # 2. Populate from ts_created for existing records
    op.execute("""
        UPDATE notifications
        SET notification_date = DATE(ts_created)
        WHERE notification_date IS NULL
    """)

    # 3. Add context_id column (student_id for attendance notifications)
    op.add_column(
        "notifications",
        sa.Column("context_id", sa.Integer(), nullable=True),
    )

    # 4. Populate context_id from payload->student_id (handles floats like "123.0")
    op.execute("""
        UPDATE notifications
        SET context_id = CASE
            WHEN payload->>'student_id' ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN FLOOR((payload->>'student_id')::numeric)::integer
            ELSE NULL
        END
        WHERE context_id IS NULL
          AND payload->>'student_id' IS NOT NULL
    """)

    # 5. Add indexes for query performance
    op.create_index(
        "ix_notifications_notification_date",
        "notifications",
        ["notification_date"],
    )
    op.create_index(
        "ix_notifications_context_id",
        "notifications",
        ["context_id"],
    )

    # 6. Partial unique index for deduplication (only INGRESO_OK/SALIDA_OK)
    op.create_index(
        "ix_notifications_dedup",
        "notifications",
        ["guardian_id", "channel", "template", "context_id", "notification_date"],
        unique=True,
        postgresql_where=sa.text(
            "template IN ('INGRESO_OK', 'SALIDA_OK') AND context_id IS NOT NULL"
        ),
    )


def downgrade() -> None:
    """Remove deduplication fields and index."""
    op.drop_index("ix_notifications_dedup", table_name="notifications")
    op.drop_index("ix_notifications_context_id", table_name="notifications")
    op.drop_index("ix_notifications_notification_date", table_name="notifications")
    op.drop_column("notifications", "context_id")
    op.drop_column("notifications", "notification_date")
