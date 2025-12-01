"""placeholder after fixing migration numbering

Revision ID: 0005_merge_heads
Revises: 0004_no_show_alerts
Create Date: 2025-11-24 17:05:00.000000

Note: This was originally a merge migration for dual 0002 revisions.
After renumbering 0002_add_absence_comment to 0006, this is now just
a placeholder in the migration chain.
"""

from __future__ import annotations


revision = "0005_merge_heads"
down_revision = "0004_no_show_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: placeholder migration after fixing numbering
    pass


def downgrade() -> None:
    # No-op
    pass
