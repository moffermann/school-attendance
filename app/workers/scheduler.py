"""Simple scheduler using APScheduler for recurring jobs."""

from __future__ import annotations

import asyncio
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from app.workers.jobs.detect_no_ingreso import _detect_and_notify
from app.workers.jobs.cleanup_photos import _cleanup


async def run_scheduler() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        _detect_and_notify,
        CronTrigger(minute="*/5"),
        name="detect_no_ingreso",
    )
    scheduler.add_job(
        _cleanup,
        CronTrigger(hour="2", minute=0),
        name="cleanup_photos",
    )

    scheduler.start()
    logger.info("Scheduler started with jobs: %s", scheduler.get_jobs())

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(run_scheduler())
