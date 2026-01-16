"""Add timestamps to students table.

Revision ID: 0017_students_timestamps
Revises: 0016_soft_delete_timestamps
Create Date: 2026-01-15 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0017_students_timestamps"
down_revision = "0016_soft_delete_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Students: agregar timestamps (status ya existe)
    op.add_column(
        "students",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "students",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Índice para ordenar por fecha de creación
    op.create_index("ix_students_created_at", "students", ["created_at"])

    # Reutilizar trigger existente (creado en migración 0016)
    op.execute("""
        CREATE TRIGGER update_students_updated_at
        BEFORE UPDATE ON students
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_students_updated_at ON students")
    op.drop_index("ix_students_created_at", table_name="students")
    op.drop_column("students", "updated_at")
    op.drop_column("students", "created_at")
