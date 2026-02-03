"""Tenant Provisioning Service for complete tenant lifecycle management."""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.tenant import Tenant
from app.db.models.tenant_admin_invitation import TenantAdminInvitation
from app.db.models.tenant_config import TenantConfig
from app.db.models.tenant_feature import TenantFeature
from app.db.repositories.tenant_features import TenantFeatureRepository
from app.db.repositories.tenants import TenantRepository

logger = logging.getLogger(__name__)


class TenantProvisioningService:
    """
    Handles complete tenant lifecycle:
    - Schema creation
    - Table migration
    - Initial admin user creation
    - Feature initialization
    - Admin invitation emails
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.tenant_repo = TenantRepository(session)
        self.feature_repo = TenantFeatureRepository(session)

    def _sanitize_slug(self, slug: str) -> str:
        """Sanitize slug for use as schema name."""
        # Convert to lowercase, replace hyphens with underscores
        sanitized = slug.lower().replace("-", "_")
        # Remove any non-alphanumeric characters except underscores
        sanitized = re.sub(r"[^a-z0-9_]", "", sanitized)
        # Ensure it starts with a letter
        if sanitized and not sanitized[0].isalpha():
            sanitized = "t_" + sanitized
        return sanitized

    async def create_tenant(
        self,
        *,
        name: str,
        slug: str,
        subdomain: str | None = None,
        domain: str | None = None,
        plan: str = "standard",
        max_students: int = 500,
        admin_email: str,
        enabled_features: list[str] | None = None,
        created_by_admin_id: int | None = None,
    ) -> Tenant:
        """
        Complete tenant provisioning workflow:

        1. Validate slug uniqueness and format
        2. Create tenant record in public.tenants
        3. Create PostgreSQL schema: tenant_<slug>
        4. Run Alembic migrations on new schema
        5. Create tenant config with default values
        6. Initialize feature flags
        7. Send admin invitation email
        """
        sanitized_slug = self._sanitize_slug(slug)
        schema_name = f"tenant_{sanitized_slug}"

        logger.info(f"Starting tenant provisioning: {name} (slug: {sanitized_slug})")

        # 1. Validate slug
        if await self.tenant_repo.slug_exists(sanitized_slug):
            raise ValueError(f"Slug '{sanitized_slug}' already exists")

        # 2. Create tenant record
        tenant = await self.tenant_repo.create(
            slug=sanitized_slug,
            name=name,
            subdomain=subdomain,
            domain=domain,
            plan=plan,
            max_students=max_students,
        )
        await self.session.flush()
        logger.info(f"Created tenant record: id={tenant.id}")

        # 3. Create schema
        await self._create_schema(schema_name)
        logger.info(f"Created PostgreSQL schema: {schema_name}")

        # 4. Run migrations
        await self._run_migrations_for_schema(schema_name)
        logger.info(f"Ran migrations for schema: {schema_name}")

        # 5. Create config
        await self._create_tenant_config(tenant.id)
        logger.info(f"Created tenant config for tenant: {tenant.id}")

        # 6. Initialize features
        await self._initialize_features(tenant.id, enabled_features)
        logger.info(f"Initialized features for tenant: {tenant.id}")

        # 7. Send admin invitation
        await self.send_admin_invitation(
            tenant_id=tenant.id,
            email=admin_email,
            created_by_admin_id=created_by_admin_id,
        )
        logger.info(f"Sent admin invitation to: {admin_email}")

        return tenant

    async def _create_schema(self, schema_name: str) -> None:
        """Create PostgreSQL schema for tenant."""
        # Validate schema name to prevent SQL injection
        if not re.match(r"^tenant_[a-z0-9_]+$", schema_name):
            raise ValueError(f"Invalid schema name: {schema_name}")

        await self.session.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        logger.debug(f"Schema created: {schema_name}")

    async def _run_migrations_for_schema(self, schema_name: str) -> None:
        """
        Run Alembic migrations targeting specific schema.

        This creates all tenant tables in the new schema.
        """
        # For now, we'll create tables directly using SQLAlchemy
        # In production, you might want to use Alembic programmatically

        # Get all table definitions from models (excluding public schema tables)

        # Set search path to target schema
        await self.session.execute(text(f"SET search_path TO {schema_name}"))

        # Create tables in the schema
        # Note: This is a simplified approach. For production, consider using
        # Alembic's programmatic API with schema_translate_map
        tables_to_create = [
            # Core tables
            "courses",
            "guardians",
            "students",
            "teachers",
            "users",
            "devices",
            "tags",
            "enrollments",
            # Association tables
            "student_guardian",
            "teacher_course",
            # Event tables
            "attendance_events",
            "absence_requests",
            "notifications",
            "schedules",
            "schedule_exceptions",
            "no_show_alerts",
            # Other tables
            "consents",
            "audit_logs",
            "webauthn_credentials",
        ]

        # Create tables by executing raw SQL (simplified approach)
        # This copies the table structure from the current schema
        for table_name in tables_to_create:
            try:
                # Check if table exists in public schema and create similar in tenant schema
                await self.session.execute(
                    text(f"""
                        CREATE TABLE IF NOT EXISTS {schema_name}.{table_name}
                        (LIKE public.{table_name} INCLUDING ALL)
                    """)
                )
            except Exception as e:
                # Table might not exist in public schema (first tenant)
                logger.warning(f"Could not copy table {table_name}: {e}")

        # Reset search path
        await self.session.execute(text("SET search_path TO public"))

        logger.debug(f"Tables created in schema: {schema_name}")

    async def _create_tenant_config(self, tenant_id: int) -> TenantConfig:
        """Create default configuration for tenant."""
        config = TenantConfig(
            tenant_id=tenant_id,
            ses_region="us-east-1",
        )
        self.session.add(config)
        await self.session.flush()
        return config

    async def _initialize_features(
        self, tenant_id: int, enabled_features: list[str] | None = None
    ) -> list[TenantFeature]:
        """Initialize all features for a new tenant with defaults."""
        features = []

        # TDD-BUG2.4 fix: Validate feature names against ALL_FEATURES
        if enabled_features:
            invalid_features = set(enabled_features) - set(TenantFeature.ALL_FEATURES)
            if invalid_features:
                raise ValueError(
                    f"Invalid feature names: {invalid_features}. "
                    f"Valid options: {TenantFeature.ALL_FEATURES}"
                )

        # Use provided features or defaults
        features_to_enable = set(enabled_features or TenantFeature.DEFAULT_ENABLED_FEATURES)

        for feature_name in TenantFeature.ALL_FEATURES:
            is_enabled = feature_name in features_to_enable
            feature = TenantFeature(
                tenant_id=tenant_id,
                feature_name=feature_name,
                is_enabled=is_enabled,
            )
            self.session.add(feature)
            features.append(feature)

        await self.session.flush()
        return features

    async def send_admin_invitation(
        self,
        *,
        tenant_id: int,
        email: str,
        created_by_admin_id: int | None = None,
    ) -> TenantAdminInvitation:
        """Generate invitation token and send activation email."""
        # Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now(UTC) + timedelta(hours=48)

        invitation = TenantAdminInvitation(
            tenant_id=tenant_id,
            email=email,
            token_hash=token_hash,
            expires_at=expires_at,
            created_by=created_by_admin_id,
        )
        self.session.add(invitation)
        await self.session.flush()

        # Queue email job
        activation_url = f"{settings.public_base_url}/app/#/setup?token={token}"
        await self._queue_invitation_email(email, activation_url)

        return invitation

    async def send_password_reset_invitation(
        self,
        *,
        tenant_id: int,
        email: str,
        created_by_admin_id: int | None = None,
    ) -> TenantAdminInvitation:
        """Send password reset invitation (similar to new invitation)."""
        return await self.send_admin_invitation(
            tenant_id=tenant_id,
            email=email,
            created_by_admin_id=created_by_admin_id,
        )

    async def _queue_invitation_email(self, email: str, activation_url: str) -> None:
        """Queue the invitation email for sending."""
        # Import here to avoid circular imports
        from redis import Redis
        from rq import Queue

        try:
            redis_conn = Redis.from_url(settings.redis_url)
            queue = Queue("notifications", connection=redis_conn)

            # Queue the email job
            queue.enqueue(
                "app.workers.jobs.send_email.send_email_message",
                None,  # notification_id (not tracked)
                email,
                "tenant_admin_invitation",
                {
                    "activation_url": activation_url,
                    "expires_hours": 48,
                },
            )
            logger.info(f"Queued invitation email for: {email}")
        except Exception as e:
            # Log but don't fail provisioning if email queue fails
            logger.error(f"Failed to queue invitation email: {e}")

    async def validate_invitation_token(self, token: str) -> TenantAdminInvitation | None:
        """Validate an invitation token."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        result = await self.session.execute(
            text("""
                SELECT * FROM public.tenant_admin_invitations
                WHERE token_hash = :token_hash
            """),
            {"token_hash": token_hash},
        )
        row = result.fetchone()

        if not row:
            return None

        # Check if already used
        if row.used_at is not None:
            return None

        # Check if expired
        if row.expires_at < datetime.now(UTC):
            return None

        return TenantAdminInvitation(
            id=row.id,
            tenant_id=row.tenant_id,
            email=row.email,
            token_hash=row.token_hash,
            expires_at=row.expires_at,
            used_at=row.used_at,
            created_by=row.created_by,
            created_at=row.created_at,
        )

    async def complete_admin_setup(
        self,
        *,
        token: str,
        password: str,
        full_name: str,
    ) -> dict[str, Any]:
        """
        Complete admin activation:

        1. Validate token against hash
        2. Check expiration
        3. Create user in tenant schema
        4. Mark invitation as used
        """
        from app.core.security import hash_password
        from app.db.session import get_tenant_session

        # Validate token
        invitation = await self.validate_invitation_token(token)
        if not invitation:
            raise ValueError("Invalid or expired activation token")

        # Get tenant for schema name
        tenant = await self.tenant_repo.get(invitation.tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")

        schema_name = f"tenant_{tenant.slug}"

        # Create admin user in tenant schema
        hashed = hash_password(password)

        async with get_tenant_session(schema_name) as tenant_session:
            # Create user
            await tenant_session.execute(
                text("""
                    INSERT INTO users (email, full_name, role, hashed_password, is_active)
                    VALUES (:email, :full_name, 'ADMIN', :hashed_password, true)
                """),
                {
                    "email": invitation.email,
                    "full_name": full_name,
                    "hashed_password": hashed,
                },
            )
            await tenant_session.commit()

        # Mark invitation as used
        await self.session.execute(
            text("""
                UPDATE public.tenant_admin_invitations
                SET used_at = :used_at
                WHERE id = :id
            """),
            {"used_at": datetime.now(UTC), "id": invitation.id},
        )
        await self.session.commit()

        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "email": invitation.email,
        }

    async def delete_tenant(self, tenant_id: int, cascade: bool = False) -> None:
        """
        Delete a tenant and optionally its schema.

        Args:
            tenant_id: The tenant to delete
            cascade: If True, drops the schema with all data
        """
        tenant = await self.tenant_repo.get(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        schema_name = f"tenant_{tenant.slug}"

        if cascade:
            # Drop the schema and all its objects
            await self.session.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
            logger.warning(f"Dropped schema with cascade: {schema_name}")

        # Delete tenant record (cascades to features, config, invitations)
        await self.session.delete(tenant)
        await self.session.commit()

        logger.info(f"Deleted tenant: {tenant.name} (id={tenant_id})")
