"""Job to mark devices as offline if no heartbeat received.

Multi-tenant aware: iterates over all active tenants and updates devices in each schema.
"""

import asyncio
from datetime import datetime, timezone, timedelta

from loguru import logger
from sqlalchemy import or_, select, update

from app.db.session import async_session, get_tenant_session
from app.db.models.device import Device
from app.db.models.tenant import Tenant
from app.core.tenant_middleware import sanitize_schema_name

# Devices without heartbeat for this duration are marked offline
OFFLINE_THRESHOLD_MINUTES = 5


async def _mark_devices_offline() -> None:
    """Mark devices as offline if last_sync is older than threshold or NULL.

    Iterates over all active tenants and updates their devices.
    """
    threshold = datetime.now(timezone.utc) - timedelta(minutes=OFFLINE_THRESHOLD_MINUTES)
    total_updated = 0

    # First, get all active tenants from public schema
    async with async_session() as session:
        result = await session.execute(
            select(Tenant).where(Tenant.is_active == True)  # noqa: E712
        )
        tenants = list(result.scalars().all())

    if not tenants:
        logger.debug("[DeviceStatus] No active tenants found")
        return

    # Process each tenant's schema
    for tenant in tenants:
        schema_name = f"tenant_{sanitize_schema_name(tenant.slug)}"

        try:
            async with get_tenant_session(schema_name) as session:
                # Update devices where online=True AND (last_sync < threshold OR last_sync is NULL)
                stmt = (
                    update(Device)
                    .where(Device.online == True)  # noqa: E712
                    .where(
                        or_(
                            Device.last_sync < threshold,
                            Device.last_sync.is_(None),
                        )
                    )
                    .values(online=False)
                )
                result = await session.execute(stmt)
                await session.commit()

                if result.rowcount > 0:
                    logger.info(
                        "[DeviceStatus] Tenant '%s': Marked %d device(s) as offline",
                        tenant.slug,
                        result.rowcount,
                    )
                    total_updated += result.rowcount
        except Exception as exc:
            logger.error(
                "[DeviceStatus] Error processing tenant '%s': %s",
                tenant.slug,
                exc,
            )
            continue

    if total_updated > 0:
        logger.info(
            "[DeviceStatus] Total: Marked %d device(s) as offline (no heartbeat in %d min)",
            total_updated,
            OFFLINE_THRESHOLD_MINUTES,
        )
    else:
        logger.debug("[DeviceStatus] All devices across all tenants are up to date")


def mark_devices_offline_job() -> None:
    """Wrapper for RQ/APScheduler."""
    try:
        asyncio.run(_mark_devices_offline())
    except Exception as exc:
        logger.error("[DeviceStatus] Job failed with error: %s", exc)
        raise
