"""Update absence_requests table with timestamps and rejection fields.

Revision ID: 0018_absence_requests_updates
Revises: 0017_students_timestamps
Create Date: 2026-01-15 14:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0018_absence_requests_updates"
down_revision = "0017_students_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar timestamps estandar
    op.add_column(
        "absence_requests",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "absence_requests",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Razon de rechazo
    op.add_column(
        "absence_requests",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )

    # Usuario que resolvio (aprobador/rechazador del sistema)
    op.add_column(
        "absence_requests",
        sa.Column(
            "resolved_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Indices para busqueda y ordenamiento
    op.create_index("ix_absence_requests_created_at", "absence_requests", ["created_at"])
    op.create_index("ix_absence_requests_type", "absence_requests", ["type"])
    op.create_index("ix_absence_requests_resolved_by_id", "absence_requests", ["resolved_by_id"])

    # Trigger para updated_at (reutilizar funcion existente de migracion 0016)
    op.execute("""
        CREATE TRIGGER update_absence_requests_updated_at
        BEFORE UPDATE ON absence_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_absence_requests_updated_at ON absence_requests")
    op.drop_index("ix_absence_requests_resolved_by_id", table_name="absence_requests")
    op.drop_index("ix_absence_requests_type", table_name="absence_requests")
    op.drop_index("ix_absence_requests_created_at", table_name="absence_requests")
    op.drop_column("absence_requests", "resolved_by_id")
    op.drop_column("absence_requests", "rejection_reason")
    op.drop_column("absence_requests", "updated_at")
    op.drop_column("absence_requests", "created_at")
