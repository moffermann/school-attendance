"""FastAPI dependencies wiring for multi-tenant support."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthUser
from app.core.config import settings
from app.core.security import decode_token
from app.db.repositories.users import UserRepository
from app.db.session import get_session, get_tenant_session
from app.services.attendance_service import AttendanceService
from app.services.attendance_notification_service import AttendanceNotificationService
from app.services.broadcast_service import BroadcastService
from app.services.consent_service import ConsentService
from app.services.device_service import DeviceService
from app.services.auth_service import AuthService
from app.services.notifications.dispatcher import NotificationDispatcher
from app.services.schedule_service import ScheduleService
from app.services.tag_provision_service import TagProvisionService
from app.services.alert_service import AlertService
from app.services.web_app_service import WebAppDataService
from app.services.absence_service import AbsenceService
from app.services.dashboard_service import DashboardService
from app.services.notification_service import NotificationService
from app.services.webauthn_service import WebAuthnService

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=True)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


# ==================== Multi-Tenant Auth Types ====================


@dataclass
class TenantAuthUser(AuthUser):
    """Extended auth user with tenant context."""

    tenant_id: int | None = None
    tenant_slug: str | None = None


@dataclass
class SuperAdminUser:
    """Super admin authentication context."""

    id: int
    email: str
    full_name: str
    role: str = "SUPER_ADMIN"
    impersonating_tenant_id: int | None = None


# ==================== Database Session Dependencies ====================


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session (public schema - for backwards compatibility)."""
    async for session in get_session():
        yield session


async def get_public_db() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for public schema (super admin operations)."""
    async for session in get_session():
        yield session


async def get_tenant_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session for the current tenant.

    Uses the tenant from request.state (set by TenantMiddleware).
    Falls back to public schema if no tenant is set.
    """
    tenant_schema = getattr(request.state, "tenant_schema", None)

    if tenant_schema:
        async for session in get_tenant_session(tenant_schema):
            yield session
    else:
        # Fallback to public schema (backwards compatibility)
        async for session in get_session():
            yield session


async def get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(session)


async def get_current_user(
    token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_db)
) -> AuthUser:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = UserRepository(session)
    user = await repo.get(int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no disponible")

    return AuthUser(
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        guardian_id=user.guardian_id,
        teacher_id=user.teacher_id,
    )


def require_roles(*roles: str) -> Callable[[AuthUser], AuthUser]:
    async def dependency(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
        return user

    return dependency


async def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    session: AsyncSession = Depends(get_db),
) -> AuthUser | None:
    if not token:
        return None
    try:
        payload = decode_token(token)
    except HTTPException:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    repo = UserRepository(session)
    user = await repo.get(int(user_id))
    if not user or not user.is_active:
        return None
    return AuthUser(
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        guardian_id=user.guardian_id,
        teacher_id=user.teacher_id,
    )


async def verify_device_key(x_device_key: str | None = Header(default=None)) -> bool:
    # R17-AUTH1 fix: Use timing-safe comparison to prevent timing attacks
    # Direct == comparison leaks information about the key via response time
    import secrets
    if x_device_key and secrets.compare_digest(x_device_key, settings.device_api_key):
        return True
    return False


async def get_attendance_notification_service(
    session: AsyncSession = Depends(get_db),
) -> AttendanceNotificationService:
    return AttendanceNotificationService(session)


async def get_attendance_service(
    session: AsyncSession = Depends(get_db),
    notification_service: AttendanceNotificationService = Depends(get_attendance_notification_service),
) -> AttendanceService:
    return AttendanceService(session, notification_service=notification_service)


async def get_notification_dispatcher(
    session: AsyncSession = Depends(get_db),
) -> NotificationDispatcher:
    return NotificationDispatcher(session)


async def get_schedule_service(
    session: AsyncSession = Depends(get_db),
) -> ScheduleService:
    return ScheduleService(session)


async def get_broadcast_service(
    session: AsyncSession = Depends(get_db),
) -> BroadcastService:
    return BroadcastService(session)


async def get_consent_service(
    session: AsyncSession = Depends(get_db),
) -> ConsentService:
    return ConsentService(session)


async def get_tag_provision_service(
    session: AsyncSession = Depends(get_db),
) -> TagProvisionService:
    return TagProvisionService(session)


async def get_device_service(
    session: AsyncSession = Depends(get_db),
) -> DeviceService:
    return DeviceService(session)


async def get_alert_service(
    session: AsyncSession = Depends(get_db),
) -> AlertService:
    return AlertService(session)


async def get_web_app_data_service(
    session: AsyncSession = Depends(get_db),
) -> WebAppDataService:
    return WebAppDataService(session)


async def get_absence_service(
    session: AsyncSession = Depends(get_db),
) -> AbsenceService:
    return AbsenceService(session)


async def get_dashboard_service(
    session: AsyncSession = Depends(get_db),
) -> DashboardService:
    return DashboardService(session)


async def get_notification_service(
    session: AsyncSession = Depends(get_db),
) -> NotificationService:
    return NotificationService(session)


async def get_webauthn_service(
    session: AsyncSession = Depends(get_db),
) -> WebAuthnService:
    return WebAuthnService(session)


# ==================== Super Admin Authentication ====================


async def get_current_super_admin(
    request: Request,
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_public_db),
) -> SuperAdminUser:
    """
    Validate JWT token and return SuperAdminUser.

    Only accepts tokens with typ='super_admin'.
    """
    from app.db.repositories.super_admins import SuperAdminRepository

    payload = decode_token(token)

    # Check token type
    token_type = payload.get("typ")
    if token_type != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere acceso de super administrador",
        )

    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    repo = SuperAdminRepository(session)
    admin = await repo.get(int(admin_id))
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Super admin no disponible"
        )

    # Check if impersonating a tenant
    impersonating = request.headers.get("X-Tenant-ID")

    return SuperAdminUser(
        id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        impersonating_tenant_id=int(impersonating) if impersonating else None,
    )


def require_super_admin() -> Callable[[SuperAdminUser], SuperAdminUser]:
    """Dependency that requires super admin authentication."""

    async def dependency(admin: SuperAdminUser = Depends(get_current_super_admin)) -> SuperAdminUser:
        return admin

    return dependency


# ==================== Tenant-Aware Authentication ====================


async def get_current_tenant_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_tenant_db),
) -> TenantAuthUser:
    """
    Validate JWT token and return TenantAuthUser with tenant context.

    Validates that the tenant_id in the token matches the request tenant.
    """
    payload = decode_token(token)

    # Check token type (allow both 'tenant' and legacy tokens without 'typ')
    token_type = payload.get("typ", "tenant")
    if token_type == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use los endpoints de super admin",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # Get tenant from token
    token_tenant_id = payload.get("tenant_id")
    token_tenant_slug = payload.get("tenant_slug")

    # Validate tenant matches request (if tenant context is present)
    request_tenant = getattr(request.state, "tenant", None)
    if request_tenant and token_tenant_id and request_tenant.id != token_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token no válido para este tenant",
        )

    repo = UserRepository(session)
    user = await repo.get(int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no disponible")

    return TenantAuthUser(
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        guardian_id=user.guardian_id,
        teacher_id=user.teacher_id,
        tenant_id=token_tenant_id,
        tenant_slug=token_tenant_slug,
    )


# ==================== Tenant Context Dependencies ====================


def get_tenant(request: Request) -> "Tenant | None":
    """Get the current tenant from request state."""
    return getattr(request.state, "tenant", None)


def require_tenant(request: Request) -> "Tenant":
    """Dependency that requires a tenant to be present."""
    tenant = get_tenant(request)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")
    return tenant


# ==================== Feature Flag Dependencies ====================


def require_feature(feature_name: str):
    """
    Dependency factory for feature flag checks.

    Usage:
        @router.post("/", dependencies=[Depends(require_feature("webauthn"))])
        async def create_credential(...):
            ...

    Args:
        feature_name: The feature name to require

    Returns:
        A dependency function that checks the feature
    """
    from app.services.feature_flag_service import FeatureFlagService

    async def check_feature(
        request: Request,
        session: AsyncSession = Depends(get_public_db),
    ) -> None:
        tenant = get_tenant(request)
        if tenant is None:
            # No tenant context - allow (backwards compatibility)
            return

        service = FeatureFlagService(session)
        await service.require_feature(tenant.id, feature_name)

    return check_feature


async def get_feature_flag_service(
    session: AsyncSession = Depends(get_public_db),
) -> "FeatureFlagService":
    """Get an instance of the FeatureFlagService."""
    from app.services.feature_flag_service import FeatureFlagService

    return FeatureFlagService(session)
