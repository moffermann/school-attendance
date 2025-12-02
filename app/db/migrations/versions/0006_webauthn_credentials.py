"""Add WebAuthn credentials table and teacher biometric permission

Revision ID: 0006_webauthn_credentials
Revises: 0005_merge_heads
Create Date: 2025-12-02 10:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0006_webauthn_credentials"
down_revision = "0005_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create webauthn_credentials table
    op.create_table(
        "webauthn_credentials",
        sa.Column("credential_id", sa.String(512), primary_key=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("user_handle", sa.LargeBinary(64), nullable=False, unique=True),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, default=0),
        sa.Column("transports", sa.String(100), nullable=True),
        sa.Column("device_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
    )

    # Add can_enroll_biometric column to teachers table
    op.add_column(
        "teachers",
        sa.Column("can_enroll_biometric", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    # Remove can_enroll_biometric column from teachers
    op.drop_column("teachers", "can_enroll_biometric")

    # Drop webauthn_credentials table
    op.drop_table("webauthn_credentials")
