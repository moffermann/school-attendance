"""Add teacher_id column to users table.

Revision ID: 0009_add_user_teacher_id
Revises: 0008_add_evidence_preference
Create Date: 2025-12-04

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_add_user_teacher_id"
down_revision = "0008_add_evidence_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists before adding
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'teacher_id'"
        )
    )
    if not result.fetchone():
        op.add_column(
            "users",
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id"), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "teacher_id")
