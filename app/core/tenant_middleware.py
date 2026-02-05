"""Tenant extraction middleware for multi-tenant support."""

from __future__ import annotations

import logging
import re
from contextvars import ContextVar
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant

logger = logging.getLogger(__name__)

# Context variable to hold the current tenant for the request
current_tenant: ContextVar[Tenant | None] = ContextVar("current_tenant", default=None)
current_tenant_schema: ContextVar[str | None] = ContextVar("current_tenant_schema", default=None)


# Endpoints that don't require tenant context
PUBLIC_ENDPOINTS = [
    "/health",
    "/healthz",
    "/api/docs",
    "/api/openapi.json",
    "/api/v1/super-admin/",
    "/api/v1/tenant-setup/",  # For tenant admin activation
    "/api/v1/attendance/",  # Kiosk attendance events (device-authenticated)
    "/api/v1/kiosk/",  # Kiosk bootstrap and sync
    "/api/v1/webauthn/kiosk/",  # Kiosk biometric auth
    "/api/v1/withdrawals/",  # Kiosk authorized withdrawals (device-authenticated)
]

# Web routes that don't require tenant context (session cookie auth)
# These are exact matches, not prefixes
WEB_PUBLIC_ROUTES = [
    "/login",
    "/logout",
    "/schedules",
    "/broadcast",
    "/alerts",
    "/photos",
    "/parents/preferences",
]

# Static asset paths that don't require tenant context
# Note: Include both with and without trailing slash for proper matching
STATIC_PREFIXES = [
    "/static/",
    "/static",
    "/lib/",
    "/lib",
    "/login-assets/",
    "/login-assets",
    "/kiosk/",
    "/kiosk",
    "/kiosk-preview/",
    "/kiosk-preview",
    "/teacher/",
    "/teacher",
    "/app/",
    "/app",
    "/favicon.ico",
]


def is_public_endpoint(path: str) -> bool:
    """Check if the path is a public endpoint that doesn't require tenant context."""
    # Check prefix matches (API endpoints)
    for endpoint in PUBLIC_ENDPOINTS:
        if path.startswith(endpoint):
            return True
    # Check exact matches or startswith for web routes
    for route in WEB_PUBLIC_ROUTES:
        if path == route or path.startswith(route + "/") or path == route + "/":
            return True
    # Root path is also public
    if path == "/":
        return True
    return False


def is_static_asset(path: str) -> bool:
    """Check if the path is a static asset."""
    for prefix in STATIC_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


def extract_subdomain(host: str) -> str | None:
    """
    Extract subdomain from the host header.

    Examples:
    - 'colegio-abc.app.example.com' -> 'colegio-abc'
    - 'app.example.com' -> None (no subdomain)
    - 'localhost:8000' -> None
    - 'colegio-abc.localhost' -> 'colegio-abc' (for development)
    """
    # Remove port if present
    host = host.split(":")[0].lower()

    # Handle localhost development
    if host == "localhost" or host == "127.0.0.1":
        return None

    # For localhost with subdomain (e.g., colegio-abc.localhost)
    if host.endswith(".localhost"):
        subdomain = host.replace(".localhost", "")
        return subdomain if subdomain else None

    # For real domains, extract first part if there are enough parts
    parts = host.split(".")

    # Need at least 3 parts for subdomain (subdomain.domain.tld)
    if len(parts) >= 3:
        # Skip 'www' as it's not a tenant subdomain
        if parts[0] == "www":
            return None
        return parts[0]

    return None


def sanitize_schema_name(slug: str) -> str:
    """
    Sanitize tenant slug for use as PostgreSQL schema name.

    Prevents SQL injection by ensuring schema name is alphanumeric with underscores.
    """
    # Only allow alphanumeric and underscore, convert hyphens to underscores
    sanitized = re.sub(r"[^a-z0-9_]", "_", slug.lower().replace("-", "_"))

    # Ensure it starts with a letter
    if not sanitized[0].isalpha():
        sanitized = "t_" + sanitized

    return sanitized


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts tenant from request and stores it in request state.

    Tenant resolution order:
    1. X-Tenant-ID header (for super admin impersonation)
    2. Custom domain lookup (tenant.domain)
    3. Subdomain extraction (tenant.subdomain)
    4. Default tenant from settings (for development)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip tenant resolution entirely if configured (for testing)
        if settings.skip_tenant_middleware:
            request.state.tenant = None
            request.state.tenant_schema = None
            return await call_next(request)

        # For static assets, skip tenant resolution completely
        if is_static_asset(path):
            request.state.tenant = None
            request.state.tenant_schema = None
            return await call_next(request)

        # For all other requests (including public endpoints), try to resolve tenant
        # Public endpoints don't REQUIRE a tenant, but can use one if available
        tenant = None
        is_public = is_public_endpoint(path)

        try:
            tenant = await self._resolve_tenant(request)
        except HTTPException:
            if not is_public:
                raise
            # For public endpoints, swallow the error and continue without tenant
        except Exception as e:
            if not is_public:
                logger.error(f"Error resolving tenant: {e}")
                raise HTTPException(status_code=500, detail="Error resolving tenant") from e
            # For public endpoints, log but continue without tenant

        if tenant is None:
            # In development, allow requests without tenant for backwards compatibility
            if settings.app_env == "development" and settings.default_tenant_slug:
                # Try to load default tenant
                tenant = await self._get_tenant_by_slug(settings.default_tenant_slug)

        if tenant is None and not is_public:
            logger.warning(f"No tenant found for host: {request.headers.get('host')}")
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Store tenant in request state
        request.state.tenant = tenant
        if tenant:
            schema_name = f"tenant_{sanitize_schema_name(tenant.slug)}"
            request.state.tenant_schema = schema_name
            # Also set context vars for use outside of request context
            current_tenant.set(tenant)
            current_tenant_schema.set(schema_name)
        else:
            request.state.tenant_schema = None
            current_tenant.set(None)
            current_tenant_schema.set(None)

        response = await call_next(request)

        # Clear context vars after request
        current_tenant.set(None)
        current_tenant_schema.set(None)

        return response

    async def _resolve_tenant(self, request: Request) -> Tenant | None:
        """Resolve tenant from request."""
        # 1. Check X-Tenant-ID header (super admin or device key)
        # TDD-BUG1.3 fix: Only accept X-Tenant-ID if token is super_admin
        # Production fix: Also accept X-Tenant-ID if request has valid device key
        tenant_id_header = request.headers.get("X-Tenant-ID")
        device_key_header = request.headers.get("X-Device-Key")
        logger.info(
            f"[TenantMiddleware] Resolving tenant: X-Tenant-ID={tenant_id_header}, "
            f"X-Device-Key={'present' if device_key_header else 'absent'}, path={request.url.path}"
        )

        if tenant_id_header:
            # Validate that the request has super_admin token OR valid device key
            has_super_admin = self._has_super_admin_token(request)
            has_device_key = await self._has_valid_device_key(request)
            logger.info(
                f"[TenantMiddleware] Auth check: super_admin={has_super_admin}, device_key={has_device_key}"
            )
            has_auth = has_super_admin or has_device_key
            if has_auth:
                try:
                    tenant_id = int(tenant_id_header)
                    tenant = await self._get_tenant_by_id(tenant_id)
                    if tenant:
                        logger.info(f"[TenantMiddleware] Tenant resolved from X-Tenant-ID: {tenant.slug}, schema=tenant_{tenant.slug}")
                        return tenant
                    else:
                        logger.warning(f"[TenantMiddleware] Tenant ID {tenant_id} not found in DB")
                except ValueError:
                    logger.warning(f"[TenantMiddleware] Invalid X-Tenant-ID header: {tenant_id_header}")
            else:
                # X-Tenant-ID header provided but no valid auth
                logger.warning(
                    "X-Tenant-ID header rejected: requires super_admin token or device key"
                )
                # Continue to other resolution methods instead of accepting header

        # Get host header
        host = request.headers.get("host", "").lower()
        if not host:
            return None

        # 2. Try custom domain lookup
        tenant = await self._get_tenant_by_domain(host.split(":")[0])
        if tenant:
            logger.debug(f"Tenant resolved from custom domain: {tenant.slug}")
            return tenant

        # 3. Try subdomain extraction
        subdomain = extract_subdomain(host)
        if subdomain:
            tenant = await self._get_tenant_by_subdomain(subdomain)
            if tenant:
                logger.debug(f"Tenant resolved from subdomain: {tenant.slug}")
                return tenant

        return None

    async def _get_tenant_by_id(self, tenant_id: int) -> Tenant | None:
        """Fetch tenant by ID from database."""
        from app.db.models.tenant import Tenant
        from app.db.session import async_session

        async with async_session() as session:
            result = await session.execute(
                select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active)
            )
            return result.scalar_one_or_none()

    async def _get_tenant_by_domain(self, domain: str) -> Tenant | None:
        """Fetch tenant by custom domain."""
        from app.db.models.tenant import Tenant
        from app.db.session import async_session

        async with async_session() as session:
            result = await session.execute(
                select(Tenant).where(Tenant.domain == domain, Tenant.is_active)
            )
            return result.scalar_one_or_none()

    async def _get_tenant_by_subdomain(self, subdomain: str) -> Tenant | None:
        """Fetch tenant by subdomain."""
        from app.db.models.tenant import Tenant
        from app.db.session import async_session

        async with async_session() as session:
            result = await session.execute(
                select(Tenant).where(Tenant.subdomain == subdomain, Tenant.is_active)
            )
            return result.scalar_one_or_none()

    async def _get_tenant_by_slug(self, slug: str) -> Tenant | None:
        """Fetch tenant by slug (for default tenant in development)."""
        from app.db.models.tenant import Tenant
        from app.db.session import async_session

        async with async_session() as session:
            result = await session.execute(
                select(Tenant).where(Tenant.slug == slug, Tenant.is_active)
            )
            return result.scalar_one_or_none()

    def _has_super_admin_token(self, request: Request) -> bool:
        """
        Check if the request has a valid super_admin token.

        TDD-BUG1.3 fix: This validates that the Authorization header contains
        a JWT token with typ='super_admin' before accepting X-Tenant-ID header.
        """
        from app.core.security import decode_token

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return False

        token = auth_header[7:]  # Remove "Bearer " prefix
        try:
            payload = decode_token(token)
            return payload.get("typ") == "super_admin"
        except Exception:
            return False

    async def _has_valid_device_key(self, request: Request) -> bool:
        """
        Check if the request has a valid device API key.

        This allows kiosk devices to specify X-Tenant-ID header when authenticated
        with X-Device-Key. Essential for multi-tenant kiosk deployments.

        Validates against tenant-specific key if X-Tenant-ID is provided,
        with fallback to global key for backwards compatibility.
        """
        import secrets as secrets_module

        from app.db.repositories.tenant_configs import TenantConfigRepository
        from app.db.session import async_session

        device_key = request.headers.get("X-Device-Key", "")
        if not device_key:
            return False

        # Try tenant-specific key if X-Tenant-ID header is present
        tenant_id_header = request.headers.get("X-Tenant-ID")
        if tenant_id_header:
            try:
                tenant_id = int(tenant_id_header)
                async with async_session() as session:
                    config_repo = TenantConfigRepository(session)
                    decrypted_config = await config_repo.get_decrypted(tenant_id)
                    if decrypted_config and decrypted_config.device_api_key:
                        if secrets_module.compare_digest(
                            device_key, decrypted_config.device_api_key
                        ):
                            return True
            except (ValueError, Exception):
                pass  # Continue to fallback

        # Fallback to global key (for backwards compatibility during migration)
        return secrets_module.compare_digest(device_key, settings.device_api_key)


def get_current_tenant(request: Request) -> Tenant | None:
    """Get the current tenant from request state."""
    return getattr(request.state, "tenant", None)


def get_current_tenant_schema(request: Request) -> str | None:
    """Get the current tenant schema name from request state."""
    return getattr(request.state, "tenant_schema", None)


def require_tenant(request: Request) -> Tenant:
    """
    Dependency that requires a tenant to be present.

    Raises HTTPException 404 if no tenant is found.
    """
    tenant = get_current_tenant(request)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
