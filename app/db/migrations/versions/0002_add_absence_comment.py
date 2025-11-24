"""add comment to absence requests

Revision ID: 0002_add_absence_comment
Revises: 0001_initial
Create Date: 2025-10-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_add_absence_comment"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("absence_requests", sa.Column("comment", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("absence_requests", "comment")
