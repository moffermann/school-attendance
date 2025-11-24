"""Device operations service implementation."""

from app.db.repositories.devices import DeviceRepository
from app.schemas.devices import DeviceHeartbeatRequest, DeviceRead


class DeviceService:
    def __init__(self, session):
        self.session = session
        self.repository = DeviceRepository(session)

    async def list_devices(self) -> list[DeviceRead]:
        devices = await self.repository.list_all()
        return [DeviceRead.model_validate(device, from_attributes=True) for device in devices]

    async def process_heartbeat(self, payload: DeviceHeartbeatRequest) -> DeviceRead:
        device = await self.repository.upsert_heartbeat(
            device_id=payload.device_id,
            gate_id=payload.gate_id,
            firmware_version=payload.firmware_version,
            battery_pct=payload.battery_pct,
            pending_events=payload.pending_events,
            online=payload.online,
        )
        await self.session.commit()
        return DeviceRead.model_validate(device)

    async def ping_device(self, device_id: int) -> DeviceRead:
        device = await self.repository.get_by_id(device_id)
        if device is None:
            raise ValueError("Dispositivo no encontrado")
        await self.repository.touch_ping(device)
        await self.session.commit()
        return DeviceRead.model_validate(device, from_attributes=True)

    async def get_logs(self, device_id: int) -> list[str]:
        device = await self.repository.get_by_id(device_id)
        if device is None:
            raise ValueError("Dispositivo no encontrado")
        now = device.last_sync or None
        ts = now.isoformat() if now else "N/A"
        return [
            f"[{ts}] INFO: Dispositivo {device.device_id} respondió al ping.",
            f"[{ts}] INFO: Cola pendiente={device.pending_events}",
            f"[{ts}] INFO: Batería={device.battery_pct}%",
        ]
