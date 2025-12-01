"""add comment to absence requests

Revision ID: 0006_add_absence_comment
Revises: 0005_merge_heads
Create Date: 2025-10-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_add_absence_comment"
down_revision = "0005_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS for idempotency (column may exist from merge migration)
    op.execute("ALTER TABLE absence_requests ADD COLUMN IF NOT EXISTS comment TEXT")


def downgrade() -> None:
    op.drop_column("absence_requests", "comment")
