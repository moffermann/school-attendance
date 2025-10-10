"""add student guardians association

Revision ID: 0003_student_guardians
Revises: 0002_add_users
Create Date: 2024-05-13 01:20:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_student_guardians"
down_revision = "0002_add_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_guardians",
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("guardian_id", sa.Integer(), sa.ForeignKey("guardians.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("student_guardians")
