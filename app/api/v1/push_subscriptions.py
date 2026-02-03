"""Push subscription API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.db.models.user import User
from app.db.repositories.push_subscriptions import PushSubscriptionRepository
from app.schemas.push_subscription import (
    PushSubscriptionCreate,
    PushSubscriptionListResponse,
    PushSubscriptionResponse,
    VapidPublicKeyResponse,
)

router = APIRouter(prefix="/push", tags=["Push Notifications"])


def get_push_repo(db: Annotated[AsyncSession, Depends(get_db)]) -> PushSubscriptionRepository:
    """Get push subscription repository."""
    return PushSubscriptionRepository(db)


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key() -> VapidPublicKeyResponse:
    """Get VAPID public key for Web Push subscription.

    This endpoint is public - no authentication required.
    The public key is needed by the browser to subscribe to push notifications.
    """
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured",
        )
    return VapidPublicKeyResponse(public_key=settings.vapid_public_key)


@router.post(
    "/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED
)
async def subscribe(
    subscription: PushSubscriptionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    push_repo: Annotated[PushSubscriptionRepository, Depends(get_push_repo)],
    user_agent: str | None = Header(None),
) -> PushSubscriptionResponse:
    """Subscribe to push notifications.

    Creates or updates a push subscription for the current user's guardian.
    """
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured",
        )

    if not current_user.guardian_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only guardians can subscribe to push notifications",
        )

    result = await push_repo.update_or_create(
        guardian_id=current_user.guardian_id,
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.p256dh,
        auth=subscription.keys.auth,
        user_agent=user_agent,
        device_name=subscription.device_name,
    )

    return PushSubscriptionResponse.model_validate(result)


@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    endpoint: str,
    current_user: Annotated[User, Depends(get_current_user)],
    push_repo: Annotated[PushSubscriptionRepository, Depends(get_push_repo)],
) -> None:
    """Unsubscribe from push notifications.

    Deactivates the subscription with the given endpoint.
    """
    subscription = await push_repo.get_by_endpoint(endpoint)

    if not subscription:
        return  # Already unsubscribed, no-op

    # Verify ownership
    if subscription.guardian_id != current_user.guardian_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to unsubscribe this device",
        )

    await push_repo.deactivate_by_endpoint(endpoint)


@router.get("/subscriptions", response_model=PushSubscriptionListResponse)
async def list_subscriptions(
    current_user: Annotated[User, Depends(get_current_user)],
    push_repo: Annotated[PushSubscriptionRepository, Depends(get_push_repo)],
) -> PushSubscriptionListResponse:
    """List all push subscriptions for the current user."""
    if not current_user.guardian_id:
        return PushSubscriptionListResponse(subscriptions=[])

    subscriptions = await push_repo.list_by_guardian(current_user.guardian_id)
    return PushSubscriptionListResponse(
        subscriptions=[PushSubscriptionResponse.model_validate(s) for s in subscriptions]
    )


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    subscription_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    push_repo: Annotated[PushSubscriptionRepository, Depends(get_push_repo)],
) -> None:
    """Delete a specific push subscription."""
    subscription = await push_repo.get_by_id(subscription_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    # Verify ownership
    if subscription.guardian_id != current_user.guardian_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this subscription",
        )

    await push_repo.delete(subscription_id)
