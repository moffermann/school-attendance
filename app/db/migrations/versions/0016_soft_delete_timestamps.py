"""Add timestamps to teachers and status/timestamps to guardians.

Revision ID: 0016_soft_delete_timestamps
Revises: 0015_smtp_email_support
Create Date: 2026-01-15 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_soft_delete_timestamps"
down_revision = "0015_smtp_email_support"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Guardian: agregar status y timestamps
    op.add_column(
        "guardians",
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="ACTIVE",
        ),
    )
    op.add_column(
        "guardians",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "guardians",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Índices para guardians
    op.create_index("ix_guardians_status", "guardians", ["status"])
    op.create_index("ix_guardians_created_at", "guardians", ["created_at"])

    # Teacher: agregar timestamps (status ya existe)
    op.add_column(
        "teachers",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "teachers",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Índice para teachers
    op.create_index("ix_teachers_created_at", "teachers", ["created_at"])

    # Trigger para auto-update de updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    op.execute("""
        CREATE TRIGGER update_teachers_updated_at
        BEFORE UPDATE ON teachers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    op.execute("""
        CREATE TRIGGER update_guardians_updated_at
        BEFORE UPDATE ON guardians
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers")
    op.execute("DROP TRIGGER IF EXISTS update_guardians_updated_at ON guardians")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    # Drop indices
    op.drop_index("ix_teachers_created_at", table_name="teachers")
    op.drop_index("ix_guardians_created_at", table_name="guardians")
    op.drop_index("ix_guardians_status", table_name="guardians")

    # Drop columns
    op.drop_column("teachers", "updated_at")
    op.drop_column("teachers", "created_at")
    op.drop_column("guardians", "updated_at")
    op.drop_column("guardians", "created_at")
    op.drop_column("guardians", "status")
