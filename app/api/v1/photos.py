"""Photo proxy endpoint for kiosk and web-app access through tunnel."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import Response as FastAPIResponse
from loguru import logger

from app.core import deps
from app.core.auth import AuthUser
from app.core.rate_limiter import limiter
from app.services.photo_service import PhotoService


router = APIRouter()


@router.get("/{key:path}")
@limiter.limit("100/minute")
async def get_photo_proxy(
    key: str,
    request: Request,
    device_authenticated: bool = Depends(deps.verify_device_key),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
) -> Response:
    """
    Proxy endpoint for serving photos through the API.

    This allows kiosk devices and web-app users to access photos through
    the API tunnel without needing direct access to MinIO.

    Accepts either:
    - Device API key (X-Device-Key header) for kiosk
    - JWT Bearer token for web-app users
    """
    # Allow access if either device key or JWT is valid
    if not device_authenticated and not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication required"
        )

    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo key is required"
        )

    photo_service = PhotoService()
    try:
        result = await photo_service.get_photo(key)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found"
            )

        photo_data, content_type = result

        # Return photo with appropriate headers for caching
        return FastAPIResponse(
            content=photo_data,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                "X-Content-Type-Options": "nosniff",
            }
        )
    finally:
        photo_service.close()
