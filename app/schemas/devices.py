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


class DeviceCreate(BaseModel):
    """Schema for creating a new device from admin UI."""

    device_id: str = Field(..., max_length=64, description="Unique device identifier (e.g., KIOSK-001)")
    gate_id: str = Field(..., max_length=64, description="Gate/door identifier (e.g., GATE-PRINCIPAL)")
    firmware_version: str = Field(default="1.0.0", max_length=32, description="Firmware version")
    battery_pct: int = Field(default=100, ge=0, le=100)
    pending_events: int = Field(default=0, ge=0)
    online: bool = Field(default=False, description="Device online status (False until first heartbeat)")


class DeviceUpdate(BaseModel):
    """Schema for updating an existing device."""

    device_id: str | None = Field(default=None, max_length=64)
    gate_id: str | None = Field(default=None, max_length=64)
    firmware_version: str | None = Field(default=None, max_length=32)
    battery_pct: int | None = Field(default=None, ge=0, le=100)
    pending_events: int | None = Field(default=None, ge=0)
    online: bool | None = None


class DeviceRead(DeviceHeartbeatRequest):
    id: int
    last_sync: datetime | None = None
