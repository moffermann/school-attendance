"""Add user_invitations table for parent setup and password reset.

Revision ID: 0020_user_invitations
Revises: 0019_absence_soft_delete
Create Date: 2026-01-23

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0020_user_invitations"
down_revision = "0019_absence_soft_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create user_invitations table."""
    op.create_table(
        "user_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), nullable=False
        ),  # No FK to avoid multi-tenant schema issues
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_user_invitations_token_hash",
        "user_invitations",
        ["token_hash"],
        unique=False,
    )


def downgrade() -> None:
    """Drop user_invitations table."""
    op.drop_index("ix_user_invitations_token_hash", table_name="user_invitations")
    op.drop_table("user_invitations")
