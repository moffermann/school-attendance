"""Fix authorized_pickups FK constraints for multi-tenant compatibility.

In multi-tenant architecture with schema-per-tenant, FK constraints that
reference users.id cannot work correctly because:
1. Tables are copied from public to tenant schemas using LIKE ... INCLUDING ALL
2. The FK constraint is copied pointing to public.users
3. But the actual users exist in tenant_<slug>.users

This migration:
1. Drops problematic FK constraints on created_by_user_id and verified_by_user_id
2. Syncs the tables to all existing tenant schemas
3. The fields are kept for audit purposes, validated at application level

Revision ID: 0027_fix_authorized_pickups_fk
Revises: 0026_authorized_pickups
Create Date: 2026-02-04
"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from alembic import op

revision = "0027_fix_authorized_pickups_fk"
down_revision = "0026_authorized_pickups"
branch_labels = None
depends_on = None

logger = logging.getLogger(__name__)


def upgrade() -> None:
    """Remove FK constraints and sync tables to tenant schemas."""
    conn = op.get_bind()

    # 1. Drop FK constraints from public schema tables
    # These FKs don't work in multi-tenant because they point to public.users
    # but the actual users are in tenant schemas

    # Drop FK on authorized_pickups.created_by_user_id
    try:
        op.drop_constraint(
            "authorized_pickups_created_by_user_id_fkey",
            "authorized_pickups",
            type_="foreignkey",
        )
        logger.info("Dropped FK constraint on authorized_pickups.created_by_user_id")
    except Exception as e:
        logger.warning(f"Could not drop authorized_pickups FK: {e}")

    # Drop FKs on student_withdrawals
    for fk_name in [
        "student_withdrawals_verified_by_user_id_fkey",
        "student_withdrawals_cancelled_by_user_id_fkey",
    ]:
        try:
            op.drop_constraint(fk_name, "student_withdrawals", type_="foreignkey")
            logger.info(f"Dropped FK constraint {fk_name}")
        except Exception as e:
            logger.warning(f"Could not drop {fk_name}: {e}")

    # 2. Sync tables to all tenant schemas
    # Get all tenant schemas
    result = conn.execute(
        sa.text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
        """)
    )
    tenant_schemas = [row[0] for row in result.fetchall()]

    tables_to_sync = [
        "authorized_pickups",
        "student_authorized_pickup",
        "student_withdrawals",
    ]

    for schema_name in tenant_schemas:
        for table_name in tables_to_sync:
            try:
                # Check if table exists in tenant schema
                exists_result = conn.execute(
                    sa.text("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = :schema
                            AND table_name = :table
                        )
                    """),
                    {"schema": schema_name, "table": table_name},
                )
                exists = exists_result.scalar()

                if not exists:
                    # Create table in tenant schema (copying structure from public)
                    # But we need to exclude the FK constraints we just dropped
                    conn.execute(
                        sa.text(f"""
                            CREATE TABLE {schema_name}.{table_name}
                            (LIKE public.{table_name} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)
                        """)
                    )
                    logger.info(f"Created {table_name} in schema {schema_name}")
                else:
                    # Table exists, drop the problematic FK constraints
                    if table_name == "authorized_pickups":
                        try:
                            conn.execute(
                                sa.text(f"""
                                    ALTER TABLE {schema_name}.{table_name}
                                    DROP CONSTRAINT IF EXISTS authorized_pickups_created_by_user_id_fkey
                                """)
                            )
                        except Exception:
                            pass

                    elif table_name == "student_withdrawals":
                        for fk in ["verified_by_user_id_fkey", "cancelled_by_user_id_fkey"]:
                            try:
                                conn.execute(
                                    sa.text(f"""
                                        ALTER TABLE {schema_name}.{table_name}
                                        DROP CONSTRAINT IF EXISTS student_withdrawals_{fk}
                                    """)
                                )
                            except Exception:
                                pass

            except Exception as e:
                logger.warning(f"Error syncing {table_name} to {schema_name}: {e}")

    logger.info(f"Synced tables to {len(tenant_schemas)} tenant schemas")


def downgrade() -> None:
    """Re-add FK constraints (note: this may fail if data is inconsistent)."""
    # Re-add FK constraints to public schema
    # Note: These may fail if there's data that violates the constraint

    try:
        op.create_foreign_key(
            "authorized_pickups_created_by_user_id_fkey",
            "authorized_pickups",
            "users",
            ["created_by_user_id"],
            ["id"],
        )
    except Exception as e:
        logger.warning(f"Could not re-add authorized_pickups FK: {e}")

    try:
        op.create_foreign_key(
            "student_withdrawals_verified_by_user_id_fkey",
            "student_withdrawals",
            "users",
            ["verified_by_user_id"],
            ["id"],
        )
    except Exception as e:
        logger.warning(f"Could not re-add student_withdrawals verified_by FK: {e}")

    try:
        op.create_foreign_key(
            "student_withdrawals_cancelled_by_user_id_fkey",
            "student_withdrawals",
            "users",
            ["cancelled_by_user_id"],
            ["id"],
        )
    except Exception as e:
        logger.warning(f"Could not re-add student_withdrawals cancelled_by FK: {e}")
