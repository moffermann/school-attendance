"""Device operations service implementation."""

from app.db.repositories.devices import DeviceRepository
from app.schemas.devices import DeviceHeartbeatRequest, DeviceRead


class DeviceService:
    def __init__(self, session):
        self.session = session
        self.repository = DeviceRepository(session)

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
