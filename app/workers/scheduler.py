"""Simple scheduler using APScheduler for recurring jobs."""

from __future__ import annotations

import asyncio
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from app.workers.jobs.detect_no_ingreso import _detect_and_notify
from app.workers.jobs.cleanup_photos import _cleanup
from app.workers.jobs.mark_devices_offline import _mark_devices_offline


async def run_scheduler() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")

    # R14-WRK1 fix: Add max_instances=1 to prevent overlapping job execution
    # coalesce=True ensures if multiple triggers fire while job is running,
    # only one execution happens after current one finishes
    scheduler.add_job(
        _detect_and_notify,
        CronTrigger(minute="*/5"),
        name="detect_no_ingreso",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _cleanup,
        CronTrigger(hour="2", minute=0),
        name="cleanup_photos",
        max_instances=1,
        coalesce=True,
    )
    # Mark devices offline if no heartbeat in 5 minutes
    scheduler.add_job(
        _mark_devices_offline,
        CronTrigger(minute="*/2"),  # Run every 2 minutes
        name="mark_devices_offline",
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    logger.info("Scheduler started with jobs: {}", scheduler.get_jobs())

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(run_scheduler())
