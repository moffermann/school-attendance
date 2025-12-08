"""Fix password hashes for demo users.

Revision ID: 0012_fix_password_hashes
Revises: 0011_seed_default_tenant
Create Date: 2025-12-08

BUG-013 fix: The original password hash in 0011 was malformed and didn't
validate correctly with passlib. This migration updates all demo user
passwords to use a correct pbkdf2_sha256 hash.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0012_fix_password_hashes"
down_revision = "0011_seed_default_tenant"
branch_labels = None
depends_on = None

# Correct pbkdf2_sha256 hash for "Demo123!" - verified with passlib
CORRECT_PASSWORD_HASH = "$pbkdf2-sha256$29000$R0hJac05x7jXWmsN4ZxT6g$90ng37I7g3E6npxCMQ3pORoP007eKXzPekyka38XM/w"

SCHEMA_NAME = "tenant_demo"


def upgrade() -> None:
    conn = op.get_bind()

    # Update super admin password in public schema
    conn.execute(
        sa.text("""
            UPDATE public.super_admins
            SET hashed_password = :password
            WHERE email = 'admin@gocode.cl'
        """),
        {"password": CORRECT_PASSWORD_HASH},
    )

    # Update tenant users passwords
    conn.execute(
        sa.text(f"""
            UPDATE {SCHEMA_NAME}.users
            SET hashed_password = :password
        """),
        {"password": CORRECT_PASSWORD_HASH},
    )

    print(f"Updated password hashes to correct format")


def downgrade() -> None:
    # No downgrade needed - the old hash was invalid anyway
    pass
