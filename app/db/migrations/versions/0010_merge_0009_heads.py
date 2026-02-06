"""Merge 0009 heads (add_user_teacher_id and multi_tenant_public_schema)

Revision ID: 0010_merge_0009_heads
Revises: 0009_add_user_teacher_id, 0009_multi_tenant_public_schema
Create Date: 2025-12-07

"""

from __future__ import annotations

revision = "0010_merge_0009_heads"
down_revision = ("0009_add_user_teacher_id", "0009_multi_tenant_public_schema")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no operations needed
    pass


def downgrade() -> None:
    # Merge migration - no operations needed
    pass
