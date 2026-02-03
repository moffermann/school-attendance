"""Add conflict_corrected field to attendance_events for sequence validation.

Revision ID: 0021_add_conflict_corrected
Revises: 0020_user_invitations
Create Date: 2026-02-03

This field tracks when the server auto-corrects IN/OUT sequence
to maintain consistency in distributed/offline scenarios.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0021_add_conflict_corrected"
down_revision = "0020_user_invitations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add conflict_corrected boolean column to attendance_events."""
    op.add_column(
        "attendance_events",
        sa.Column(
            "conflict_corrected",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    # Index for dashboard queries (list corrected events)
    op.create_index(
        "ix_attendance_events_conflict_corrected",
        "attendance_events",
        ["conflict_corrected"],
        postgresql_where=sa.text("conflict_corrected = true"),
    )


def downgrade() -> None:
    """Remove conflict_corrected column."""
    op.drop_index(
        "ix_attendance_events_conflict_corrected",
        table_name="attendance_events",
    )
    op.drop_column("attendance_events", "conflict_corrected")
