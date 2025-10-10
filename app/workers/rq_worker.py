"""RQ worker bootstrap (stub)."""

from rq import Connection, Worker
from redis import Redis

from app.core.config import settings


def run_worker(queues: list[str] | None = None) -> None:  # pragma: no cover - runtime only
    queues = queues or ["default", "notifications", "broadcasts"]
    redis = Redis.from_url(settings.redis_url)
    with Connection(redis):
        worker = Worker(map(str, queues))
        worker.work(with_scheduler=True)


if __name__ == "__main__":  # pragma: no cover - script entry
    run_worker()
