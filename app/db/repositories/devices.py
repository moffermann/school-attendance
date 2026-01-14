"""Device repository with race condition protection."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.device import Device

logger = logging.getLogger(__name__)


class DeviceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[Device]:
        result = await self.session.execute(select(Device).order_by(Device.gate_id, Device.device_id))
        return list(result.scalars().all())

    async def get_by_id(self, device_id: int) -> Device | None:
        return await self.session.get(Device, device_id)

    async def get_by_device_id(self, device_id: str) -> Device | None:
        """Get device by its device_id string."""
        stmt = select(Device).where(Device.device_id == device_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

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
        """Upsert device heartbeat atomically.

        Uses the unique constraint on device_id to handle race conditions:
        - If device exists, updates it
        - If device doesn't exist, creates it
        - If concurrent insert happens, catches IntegrityError and updates existing
        """
        device = await self.get_by_device_id(device_id)

        if device is not None:
            # Device exists - update it
            device.gate_id = gate_id
            device.firmware_version = firmware_version
            device.battery_pct = battery_pct
            device.pending_events = pending_events
            device.online = online
            # R7-B1 fix: Use timezone-aware datetime
            device.last_sync = datetime.now(timezone.utc)
            await self.session.flush()
            return device

        # Try to create new device
        device = Device(
            device_id=device_id,
            gate_id=gate_id,
            firmware_version=firmware_version,
            battery_pct=battery_pct,
            pending_events=pending_events,
            online=online,
            last_sync=datetime.now(timezone.utc),  # R7-B1 fix
        )
        self.session.add(device)

        try:
            await self.session.flush()
            return device
        except IntegrityError:
            # Race condition: another process created the device
            await self.session.rollback()
            logger.info(f"Race condition handled: device {device_id} already exists")
            # Fetch existing and update
            device = await self.get_by_device_id(device_id)
            if device:
                device.gate_id = gate_id
                device.firmware_version = firmware_version
                device.battery_pct = battery_pct
                device.pending_events = pending_events
                device.online = online
                # R7-B1 fix: Use timezone-aware datetime
                device.last_sync = datetime.now(timezone.utc)
                await self.session.flush()
                return device
            # This shouldn't happen, but re-raise if it does
            raise

    async def touch_ping(self, device: Device) -> Device:
        # R7-B1 fix: Use timezone-aware datetime
        device.last_sync = datetime.now(timezone.utc)
        device.online = True
        await self.session.flush()
        return device

    async def create(
        self,
        *,
        device_id: str,
        gate_id: str,
        firmware_version: str = "1.0.0",
        battery_pct: int = 100,
        pending_events: int = 0,
        online: bool = False,
    ) -> Device:
        """Create a new device from admin UI."""
        device = Device(
            device_id=device_id,
            gate_id=gate_id,
            firmware_version=firmware_version,
            battery_pct=battery_pct,
            pending_events=pending_events,
            online=online,
            last_sync=None,  # No sync yet - device created manually
        )
        self.session.add(device)
        await self.session.flush()
        return device

    async def update(self, device: Device, **kwargs) -> Device:
        """Update device fields."""
        for key, value in kwargs.items():
            if value is not None and hasattr(device, key):
                setattr(device, key, value)
        await self.session.flush()
        return device

    async def delete(self, device: Device) -> None:
        """Delete a device."""
        await self.session.delete(device)
        await self.session.flush()
