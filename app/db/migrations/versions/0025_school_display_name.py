"""Add school_display_name column to tenant_configs.

Allows each tenant to configure a display name for their school
that will be shown in email notifications sent to parents.

Revision ID: 0025_school_display_name
Revises: 0024_tenant_timezone
Create Date: 2026-02-04
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0025_school_display_name"
down_revision = "0024_tenant_timezone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add school_display_name column for branding in email notifications
    op.add_column(
        "tenant_configs",
        sa.Column("school_display_name", sa.String(255), nullable=True),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("tenant_configs", "school_display_name", schema="public")
