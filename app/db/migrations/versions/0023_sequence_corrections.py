"""Add sequence_corrections audit table.

Revision ID: 0023_sequence_corrections
Revises: 0022_notification_dedup
Create Date: 2026-02-03

Creates audit log for auto-corrected attendance event sequences.
Tracks when server changes IN→OUT or OUT→IN to identify
problematic devices and synchronization patterns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0023_sequence_corrections"
down_revision = "0022_notification_dedup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create sequence_corrections audit table."""
    op.create_table(
        "sequence_corrections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("attendance_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_type", sa.String(10), nullable=False),
        sa.Column("corrected_type", sa.String(10), nullable=False),
        sa.Column("device_id", sa.String(64), nullable=False),
        sa.Column("gate_id", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "corrected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Indexes for common queries
    op.create_index(
        "ix_sequence_corrections_event_id",
        "sequence_corrections",
        ["event_id"],
    )
    op.create_index(
        "ix_sequence_corrections_student_id",
        "sequence_corrections",
        ["student_id"],
    )
    op.create_index(
        "ix_sequence_corrections_device_id",
        "sequence_corrections",
        ["device_id"],
    )
    # Index for dashboard: recent corrections
    op.create_index(
        "ix_sequence_corrections_corrected_at",
        "sequence_corrections",
        ["corrected_at"],
    )


def downgrade() -> None:
    """Drop sequence_corrections table."""
    op.drop_index(
        "ix_sequence_corrections_corrected_at",
        table_name="sequence_corrections",
    )
    op.drop_index(
        "ix_sequence_corrections_device_id",
        table_name="sequence_corrections",
    )
    op.drop_index(
        "ix_sequence_corrections_student_id",
        table_name="sequence_corrections",
    )
    op.drop_index(
        "ix_sequence_corrections_event_id",
        table_name="sequence_corrections",
    )
    op.drop_table("sequence_corrections")
