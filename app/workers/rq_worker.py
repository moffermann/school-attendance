"""RQ worker bootstrap (stub)."""

from redis import Redis
from rq import Worker

from app.core.config import settings


def run_worker(queues: list[str] | None = None) -> None:  # pragma: no cover - runtime only
    queues = queues or ["default", "notifications", "broadcasts"]
    redis = Redis.from_url(settings.redis_url)
    worker = Worker(queues, connection=redis)
    worker.work(with_scheduler=True)


if __name__ == "__main__":  # pragma: no cover - script entry
    run_worker()
