"""Device operations for kiosks."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.devices import DeviceHeartbeatRequest, DeviceRead
from app.services.device_service import DeviceService


router = APIRouter()


@router.post("/heartbeat", response_model=DeviceRead)
async def heartbeat(
    payload: DeviceHeartbeatRequest,
    service: DeviceService = Depends(deps.get_device_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> DeviceRead:
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return await service.process_heartbeat(payload)
