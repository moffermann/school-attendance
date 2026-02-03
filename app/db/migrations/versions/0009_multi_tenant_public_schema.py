"""Create multi-tenant public schema tables.

Revision ID: 0009_multi_tenant_public_schema
Revises: 0008_add_evidence_preference
Create Date: 2025-12-07

This migration creates the infrastructure tables for multi-tenancy:
- tenants: Registry of all tenants (schools)
- super_admins: Platform administrators
- tenant_features: Feature flags per tenant
- tenant_configs: Encrypted credentials per tenant (WhatsApp, SES)
- tenant_admin_invitations: Admin activation tokens
- usage_stats: Usage metrics per tenant
- tenant_audit_logs: Super admin action audit trail
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_multi_tenant_public_schema"
down_revision = "0008_add_evidence_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenants table
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True, unique=True),
        sa.Column("subdomain", sa.String(64), nullable=True, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("plan", sa.String(32), nullable=False, server_default="standard"),
        sa.Column("max_students", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="public",
    )
    op.create_index("idx_tenants_domain", "tenants", ["domain"], schema="public")
    op.create_index("idx_tenants_subdomain", "tenants", ["subdomain"], schema="public")
    op.create_index("idx_tenants_slug", "tenants", ["slug"], schema="public")

    # Create super_admins table
    op.create_table(
        "super_admins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )
    op.create_index("idx_super_admins_email", "super_admins", ["email"], schema="public")

    # Create tenant_features table
    op.create_table(
        "tenant_features",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("public.tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("feature_name", sa.String(64), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("tenant_id", "feature_name", name="uq_tenant_feature"),
        schema="public",
    )
    op.create_index(
        "idx_tenant_features_tenant_id", "tenant_features", ["tenant_id"], schema="public"
    )

    # Create tenant_configs table (encrypted credentials)
    op.create_table(
        "tenant_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("public.tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # WhatsApp credentials (encrypted)
        sa.Column("whatsapp_access_token_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("whatsapp_phone_number_id", sa.String(64), nullable=True),
        # AWS SES credentials (encrypted)
        sa.Column("ses_region", sa.String(32), nullable=True, server_default="us-east-1"),
        sa.Column("ses_source_email", sa.String(255), nullable=True),
        sa.Column("ses_access_key_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("ses_secret_key_encrypted", sa.LargeBinary(), nullable=True),
        # S3 storage config
        sa.Column("s3_bucket", sa.String(255), nullable=True),
        sa.Column("s3_prefix", sa.String(255), nullable=True),
        # Device API key (encrypted)
        sa.Column("device_api_key_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="public",
    )

    # Create tenant_admin_invitations table
    op.create_table(
        "tenant_admin_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("public.tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("public.super_admins.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="public",
    )
    op.create_index(
        "idx_tenant_admin_invitations_token",
        "tenant_admin_invitations",
        ["token_hash"],
        schema="public",
    )
    op.create_index(
        "idx_tenant_admin_invitations_tenant",
        "tenant_admin_invitations",
        ["tenant_id"],
        schema="public",
    )

    # Create usage_stats table
    op.create_table(
        "usage_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("public.tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("metric_name", sa.String(64), nullable=False),
        sa.Column("value", sa.BigInteger(), nullable=False, server_default="0"),
        sa.UniqueConstraint(
            "tenant_id", "stat_date", "metric_name", name="uq_usage_stats_tenant_date_metric"
        ),
        schema="public",
    )
    op.create_index(
        "idx_usage_stats_tenant_date",
        "usage_stats",
        ["tenant_id", "stat_date"],
        schema="public",
    )

    # Create tenant_audit_logs table
    op.create_table(
        "tenant_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("public.tenants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "super_admin_id",
            sa.Integer(),
            sa.ForeignKey("public.super_admins.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity", sa.String(64), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="public",
    )
    op.create_index(
        "idx_tenant_audit_logs_tenant",
        "tenant_audit_logs",
        ["tenant_id"],
        schema="public",
    )
    op.create_index(
        "idx_tenant_audit_logs_admin",
        "tenant_audit_logs",
        ["super_admin_id"],
        schema="public",
    )
    op.create_index(
        "idx_tenant_audit_logs_created",
        "tenant_audit_logs",
        ["created_at"],
        schema="public",
    )


def downgrade() -> None:
    op.drop_table("tenant_audit_logs", schema="public")
    op.drop_table("usage_stats", schema="public")
    op.drop_table("tenant_admin_invitations", schema="public")
    op.drop_table("tenant_configs", schema="public")
    op.drop_table("tenant_features", schema="public")
    op.drop_table("super_admins", schema="public")
    op.drop_table("tenants", schema="public")
