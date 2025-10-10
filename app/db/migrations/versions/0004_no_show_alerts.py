"""create no_show_alerts table

Revision ID: 0004_no_show_alerts
Revises: 0003_student_guardians
Create Date: 2024-05-13 02:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_no_show_alerts"
down_revision = "0003_student_guardians"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "no_show_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guardian_id", sa.Integer(), sa.ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("schedule_id", sa.Integer(), sa.ForeignKey("schedules.id"), nullable=True),
        sa.Column("alert_date", sa.Date(), nullable=False),
        sa.Column("alerted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.String(length=512), nullable=True),
        sa.Column("notification_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_notification_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("student_id", "guardian_id", "alert_date", name="uq_no_show_student_guardian_date"),
    )
    op.create_index("ix_no_show_alerts_student", "no_show_alerts", ["student_id"])
    op.create_index("ix_no_show_alerts_guardian", "no_show_alerts", ["guardian_id"])


def downgrade() -> None:
    op.drop_index("ix_no_show_alerts_guardian", table_name="no_show_alerts")
    op.drop_index("ix_no_show_alerts_student", table_name="no_show_alerts")
    op.drop_table("no_show_alerts")
