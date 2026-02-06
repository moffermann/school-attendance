"""Add status and timestamps to courses table

Revision ID: 0012_course_status
Revises: 0011_push_subscriptions
Create Date: 2025-12-16 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012_course_status"
down_revision = "0011_push_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status column with default ACTIVE
    op.add_column(
        "courses",
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="ACTIVE",
        ),
    )
    op.create_index("ix_courses_status", "courses", ["status"])

    # Add timestamps
    op.add_column(
        "courses",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "courses",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "updated_at")
    op.drop_column("courses", "created_at")
    op.drop_index("ix_courses_status", table_name="courses")
    op.drop_column("courses", "status")
