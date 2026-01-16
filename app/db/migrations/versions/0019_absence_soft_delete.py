"""Add soft delete fields to absence_requests.

Revision ID: 0019_absence_soft_delete
Revises: 0018_absence_requests_updates
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0019_absence_soft_delete"
down_revision = "0018_absence_requests_updates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add deleted_at and deleted_by_id columns for soft delete."""
    op.add_column(
        "absence_requests",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "absence_requests",
        sa.Column(
            "deleted_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # Index for efficient filtering of non-deleted records
    op.create_index(
        "ix_absence_requests_deleted_at",
        "absence_requests",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove soft delete columns."""
    op.drop_index("ix_absence_requests_deleted_at", table_name="absence_requests")
    op.drop_column("absence_requests", "deleted_by_id")
    op.drop_column("absence_requests", "deleted_at")
