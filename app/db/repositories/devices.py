"""Device repository stub."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.device import Device


class DeviceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert_heartbeat(
        self,
        *,
        device_id: str,
        gate_id: str,
        firmware_version: str,
        battery_pct: int,
        pending_events: int,
        online: bool,
    ) -> Device:
        stmt = select(Device).where(Device.device_id == device_id)
        result = await self.session.execute(stmt)
        device = result.scalar_one_or_none()

        if device is None:
            device = Device(
                device_id=device_id,
                gate_id=gate_id,
                firmware_version=firmware_version,
                battery_pct=battery_pct,
                pending_events=pending_events,
                online=online,
                last_sync=datetime.utcnow(),
            )
            self.session.add(device)
        else:
            device.gate_id = gate_id
            device.firmware_version = firmware_version
            device.battery_pct = battery_pct
            device.pending_events = pending_events
            device.online = online
            device.last_sync = datetime.utcnow()

        await self.session.flush()
        return device
