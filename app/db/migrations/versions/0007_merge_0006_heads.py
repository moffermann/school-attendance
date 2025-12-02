"""Merge 0006 heads (absence_comment and webauthn_credentials)

Revision ID: 0007_merge_0006_heads
Revises: 0006_add_absence_comment, 0006_webauthn_credentials
Create Date: 2025-12-02

"""

from __future__ import annotations


revision = "0007_merge_0006_heads"
down_revision = ("0006_add_absence_comment", "0006_webauthn_credentials")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no operations needed
    pass


def downgrade() -> None:
    # Merge migration - no operations needed
    pass
