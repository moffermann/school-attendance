"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2024-05-13 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN CREATE TYPE attendance_type AS ENUM ('IN','OUT'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    attendance_type = postgresql.ENUM("IN", "OUT", name="attendance_type", create_type=False)

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("grade", sa.String(length=32), nullable=False),
    )

    op.create_table(
        "guardians",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("contacts", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("notification_prefs", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )

    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
        sa.Column("qr_code_hash", sa.String(length=128), nullable=True),
        sa.Column(
            "photo_pref_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.create_index("ix_students_id", "students", ["id"], unique=False)

    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("gate_id", sa.String(length=64), nullable=False),
        sa.Column("firmware_version", sa.String(length=32), nullable=False),
        sa.Column("battery_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("pending_events", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("online", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("tag_token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("tag_token_preview", sa.String(length=16), nullable=False),
        sa.Column("tag_uid", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("school_year", sa.String(length=16), nullable=False),
    )

    op.create_table(
        "attendance_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("type", attendance_type, nullable=False),
        sa.Column("gate_id", sa.String(length=64), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("local_seq", sa.Integer(), nullable=True),
        sa.Column("photo_ref", sa.String(length=512), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_attendance_events_student", "attendance_events", ["student_id"], unique=False
    )

    op.create_table(
        "absence_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("attachment_ref", sa.String(length=512), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("guardians.id"), nullable=True),
        sa.Column("ts_submitted", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ts_resolved", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("attendance_events.id"), nullable=True),
        sa.Column("guardian_id", sa.Integer(), sa.ForeignKey("guardians.id"), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("template", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("ts_created", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ts_sent", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "consents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column("guardian_id", sa.Integer(), sa.ForeignKey("guardians.id"), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("ts_signed", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ts_expires", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("in_time", sa.Time(), nullable=False),
        sa.Column("out_time", sa.Time(), nullable=False),
    )

    op.create_table(
        "schedule_exceptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("in_time", sa.Time(), nullable=True),
        sa.Column("out_time", sa.Time(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("schedule_exceptions")
    op.drop_table("schedules")
    op.drop_table("consents")
    op.drop_table("notifications")
    op.drop_table("absence_requests")
    op.drop_table("attendance_events")
    op.drop_table("enrollments")
    op.drop_table("tags")
    op.drop_table("devices")
    op.drop_table("students")
    op.drop_table("guardians")
    op.drop_table("courses")
    attendance_type = sa.Enum("IN", "OUT", name="attendance_type")
    attendance_type.drop(op.get_bind(), checkfirst=True)
