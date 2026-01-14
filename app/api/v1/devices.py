"""Device operations for kiosks."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.devices import DeviceCreate, DeviceHeartbeatRequest, DeviceRead, DeviceUpdate
from app.services.device_service import DeviceService


router = APIRouter()


@router.get("", response_model=list[DeviceRead])
async def list_devices(
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[DeviceRead]:
    return await service.list_devices()


@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> DeviceRead:
    """Create a new device/kiosk."""
    try:
        return await service.create_device(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{device_id}", response_model=DeviceRead)
async def update_device(
    device_id: int,
    payload: DeviceUpdate,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> DeviceRead:
    """Update an existing device."""
    try:
        return await service.update_device(device_id, payload)
    except ValueError as exc:
        if "no encontrado" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Delete a device."""
    try:
        await service.delete_device(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


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


@router.post("/{device_id}/ping", response_model=DeviceRead)
async def ping_device(
    device_id: int,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> DeviceRead:
    try:
        return await service.ping_device(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{device_id}/logs", response_model=list[str])
async def device_logs(
    device_id: int,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[str]:
    try:
        return await service.get_logs(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
