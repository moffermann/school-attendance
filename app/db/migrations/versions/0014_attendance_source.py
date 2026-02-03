"""Add source column to attendance_events.

Revision ID: 0014_attendance_source
Revises: 0013_student_natid_photo
Create Date: 2026-01-12
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0014_attendance_source"
down_revision = "0013_student_natid_photo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type first
    attendance_source = sa.Enum("BIOMETRIC", "QR", "NFC", "MANUAL", name="attendance_source")
    attendance_source.create(op.get_bind(), checkfirst=True)

    # Add the source column
    op.add_column("attendance_events", sa.Column("source", attendance_source, nullable=True))
    # Add index for filtering by source
    op.create_index("ix_attendance_events_source", "attendance_events", ["source"])


def downgrade() -> None:
    op.drop_index("ix_attendance_events_source", table_name="attendance_events")
    op.drop_column("attendance_events", "source")
    # Drop the enum type
    sa.Enum(name="attendance_source").drop(op.get_bind(), checkfirst=True)
