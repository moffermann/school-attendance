"""FastAPI dependencies wiring (placeholder)."""

from collections.abc import AsyncGenerator
from typing import Callable

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthUser
from app.core.config import settings
from app.core.security import decode_token
from app.db.repositories.users import UserRepository
from app.db.session import get_session
from app.services.attendance_service import AttendanceService
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


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=True)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
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

    return AuthUser(id=user.id, role=user.role, full_name=user.full_name, guardian_id=user.guardian_id)


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
    return AuthUser(id=user.id, role=user.role, full_name=user.full_name, guardian_id=user.guardian_id)


async def verify_device_key(x_device_key: str | None = Header(default=None)) -> bool:
    if x_device_key and x_device_key == settings.device_api_key:
        return True
    return False


async def get_attendance_service(
    session: AsyncSession = Depends(get_db),
) -> AttendanceService:
    return AttendanceService(session)


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
