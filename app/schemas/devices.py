"""Device schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class DeviceHeartbeatRequest(BaseModel):
    # R13-VAL2 fix: Add max_length to match DB constraint (64 chars)
    device_id: str = Field(..., max_length=64)
    gate_id: str = Field(..., max_length=64)
    firmware_version: str = Field(..., max_length=32)
    # R3-V11 fix: Validate battery percentage range 0-100
    battery_pct: int = Field(..., ge=0, le=100)
    # R3-V12 fix: Validate pending_events is non-negative
    pending_events: int = Field(..., ge=0)
    online: bool = True


class DeviceRead(DeviceHeartbeatRequest):
    id: int
    last_sync: datetime | None = None
