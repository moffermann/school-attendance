"""Add SMTP email support columns to tenant_configs.

Allows tenants to use Gmail, Google Workspace, Outlook or any SMTP server
as an alternative to AWS SES for sending emails.

Revision ID: 0015_smtp_email_support
Revises: 0014_attendance_source
Create Date: 2026-01-13
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0015_smtp_email_support"
down_revision = "0014_attendance_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email_provider column to select between SES and SMTP
    op.add_column(
        "tenant_configs",
        sa.Column("email_provider", sa.String(16), nullable=True, server_default="ses"),
        schema="public"
    )

    # Add SMTP configuration columns
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_host", sa.String(255), nullable=True),
        schema="public"
    )
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_port", sa.Integer(), nullable=True, server_default="587"),
        schema="public"
    )
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_user", sa.String(255), nullable=True),
        schema="public"
    )
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_password_encrypted", sa.LargeBinary(), nullable=True),
        schema="public"
    )
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=True, server_default="true"),
        schema="public"
    )
    op.add_column(
        "tenant_configs",
        sa.Column("smtp_from_name", sa.String(255), nullable=True),
        schema="public"
    )


def downgrade() -> None:
    op.drop_column("tenant_configs", "smtp_from_name", schema="public")
    op.drop_column("tenant_configs", "smtp_use_tls", schema="public")
    op.drop_column("tenant_configs", "smtp_password_encrypted", schema="public")
    op.drop_column("tenant_configs", "smtp_user", schema="public")
    op.drop_column("tenant_configs", "smtp_port", schema="public")
    op.drop_column("tenant_configs", "smtp_host", schema="public")
    op.drop_column("tenant_configs", "email_provider", schema="public")
