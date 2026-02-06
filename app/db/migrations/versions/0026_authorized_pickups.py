"""Add authorized pickups and student withdrawals tables.

This migration adds the "Retiros Autorizados" feature:
- authorized_pickups: Adults authorized to withdraw students
- student_authorized_pickup: Many-to-many relationship with students
- student_withdrawals: Auditable record of each withdrawal

Revision ID: 0026_authorized_pickups
Revises: 0025_school_display_name
Create Date: 2026-02-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_authorized_pickups"
down_revision = "0025_school_display_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create authorized pickups and student withdrawals tables."""

    # 1. Create authorized_pickups table
    op.create_table(
        "authorized_pickups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("national_id", sa.String(20), nullable=True),
        sa.Column("relationship_type", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("qr_code_hash", sa.String(64), nullable=True, unique=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    # Indexes for authorized_pickups
    op.create_index(
        "ix_authorized_pickups_national_id",
        "authorized_pickups",
        ["national_id"],
    )
    op.create_index(
        "ix_authorized_pickups_qr_code_hash",
        "authorized_pickups",
        ["qr_code_hash"],
    )
    op.create_index(
        "ix_authorized_pickups_is_active",
        "authorized_pickups",
        ["is_active"],
    )

    # 2. Create student_authorized_pickup association table
    op.create_table(
        "student_authorized_pickup",
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "authorized_pickup_id",
            sa.Integer(),
            sa.ForeignKey("authorized_pickups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("priority", sa.Integer(), server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. Create student_withdrawals table
    op.create_table(
        "student_withdrawals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id"),
            nullable=False,
        ),
        sa.Column(
            "authorized_pickup_id",
            sa.Integer(),
            sa.ForeignKey("authorized_pickups.id"),
            nullable=True,
        ),
        # Status: INITIATED, VERIFIED, COMPLETED, CANCELLED
        sa.Column("status", sa.String(20), server_default="INITIATED"),
        # Verification
        sa.Column("verification_method", sa.String(20), nullable=True),
        sa.Column(
            "verified_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        # Cancellation
        sa.Column(
            "cancelled_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        # Evidence
        sa.Column("pickup_photo_ref", sa.String(500), nullable=True),
        sa.Column("signature_data", sa.Text(), nullable=True),
        # Context
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("device_id", sa.String(100), nullable=True),
        # Timestamps
        sa.Column(
            "initiated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        # Audit metadata
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
    )

    # Indexes for student_withdrawals
    op.create_index(
        "ix_student_withdrawals_student_id",
        "student_withdrawals",
        ["student_id"],
    )
    op.create_index(
        "ix_student_withdrawals_authorized_pickup_id",
        "student_withdrawals",
        ["authorized_pickup_id"],
    )
    op.create_index(
        "ix_student_withdrawals_status",
        "student_withdrawals",
        ["status"],
    )
    op.create_index(
        "ix_student_withdrawals_initiated_at",
        "student_withdrawals",
        ["initiated_at"],
    )

    # CRITICAL: Unique partial index to prevent race conditions
    # Only one COMPLETED withdrawal per student per day
    # Note: Use CAST syntax (not ::) for asyncpg compatibility
    op.execute(
        "CREATE UNIQUE INDEX uq_withdrawal_student_date_completed "
        "ON student_withdrawals (student_id, CAST(initiated_at AT TIME ZONE 'UTC' AS date)) "
        "WHERE status = 'COMPLETED'"
    )


def downgrade() -> None:
    """Drop authorized pickups and student withdrawals tables."""
    # Drop partial unique index first
    op.execute("DROP INDEX IF EXISTS uq_withdrawal_student_date_completed")

    # Drop indexes
    op.drop_index("ix_student_withdrawals_initiated_at", table_name="student_withdrawals")
    op.drop_index("ix_student_withdrawals_status", table_name="student_withdrawals")
    op.drop_index("ix_student_withdrawals_authorized_pickup_id", table_name="student_withdrawals")
    op.drop_index("ix_student_withdrawals_student_id", table_name="student_withdrawals")

    # Drop tables (order matters due to foreign keys)
    op.drop_table("student_withdrawals")
    op.drop_table("student_authorized_pickup")

    op.drop_index("ix_authorized_pickups_is_active", table_name="authorized_pickups")
    op.drop_index("ix_authorized_pickups_qr_code_hash", table_name="authorized_pickups")
    op.drop_index("ix_authorized_pickups_national_id", table_name="authorized_pickups")
    op.drop_table("authorized_pickups")
