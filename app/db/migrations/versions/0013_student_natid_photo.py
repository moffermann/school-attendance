"""Add national_id and photo_url columns to students table

Revision ID: 0013_add_student_national_id_photo
Revises: 0012_course_status
Create Date: 2025-01-12 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0013_student_natid_photo"
down_revision = "0012_course_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add national_id column (RUT in Chile, DNI in Argentina, etc.) with index
    op.add_column(
        "students",
        sa.Column("national_id", sa.String(20), nullable=True),
    )
    op.create_index("ix_students_national_id", "students", ["national_id"])

    # Add photo_url column for student photos
    op.add_column(
        "students",
        sa.Column("photo_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("students", "photo_url")
    op.drop_index("ix_students_national_id", table_name="students")
    op.drop_column("students", "national_id")
