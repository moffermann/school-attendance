"""Add evidence_preference column to students and audio_ref to attendance_events.

Revision ID: 0005
Revises: 0004
Create Date: 2024-12-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add evidence_preference column with default "none"
    op.add_column(
        "students",
        sa.Column("evidence_preference", sa.String(16), nullable=False, server_default="none"),
    )

    # Migrate existing photo_pref_opt_in=true to evidence_preference="photo"
    op.execute(
        "UPDATE students SET evidence_preference = 'photo' WHERE photo_pref_opt_in = true"
    )

    # Add audio_ref column to attendance_events
    op.add_column(
        "attendance_events",
        sa.Column("audio_ref", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("attendance_events", "audio_ref")
    op.drop_column("students", "evidence_preference")
