"""Add timezone column to tenant_configs.

Allows each tenant to configure their local timezone for displaying
times in notifications and reports (e.g., America/Santiago, America/Bogota).

Revision ID: 0024_tenant_timezone
Revises: 0023_sequence_corrections
Create Date: 2026-02-03
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0024_tenant_timezone"
down_revision = "0023_sequence_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add timezone column with default America/Santiago (Chile)
    op.add_column(
        "tenant_configs",
        sa.Column("timezone", sa.String(64), nullable=True, server_default="America/Santiago"),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("tenant_configs", "timezone", schema="public")
