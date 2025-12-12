"""Push subscription schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    """Web Push subscription keys from browser."""

    p256dh: str = Field(..., description="P-256 public key")
    auth: str = Field(..., description="Auth secret")


class PushSubscriptionCreate(BaseModel):
    """Request body for creating a push subscription."""

    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: PushSubscriptionKeys = Field(..., description="Subscription keys")
    device_name: str | None = Field(None, max_length=100, description="Device name for display")


class PushSubscriptionResponse(BaseModel):
    """Response for a push subscription."""

    id: int
    guardian_id: int
    endpoint: str
    device_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VapidPublicKeyResponse(BaseModel):
    """Response with VAPID public key."""

    public_key: str = Field(..., description="VAPID public key for Web Push subscription")


class PushSubscriptionListResponse(BaseModel):
    """Response listing all subscriptions."""

    subscriptions: list[PushSubscriptionResponse]
