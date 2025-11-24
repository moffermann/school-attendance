"""merge branches after dual 0002 revisions

Revision ID: 0005_merge_heads
Revises: 0002_add_absence_comment, 0004_no_show_alerts
Create Date: 2025-11-24 17:05:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "0005_merge_heads"
down_revision = ("0002_add_absence_comment", "0004_no_show_alerts")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE absence_requests ADD COLUMN IF NOT EXISTS comment TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE absence_requests DROP COLUMN IF EXISTS comment")
