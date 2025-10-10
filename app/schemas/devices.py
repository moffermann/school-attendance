"""Device schemas."""

from datetime import datetime

from pydantic import BaseModel


class DeviceHeartbeatRequest(BaseModel):
    device_id: str
    gate_id: str
    firmware_version: str
    battery_pct: int
    pending_events: int
    online: bool = True


class DeviceRead(DeviceHeartbeatRequest):
    id: int
    last_sync: datetime | None = None
