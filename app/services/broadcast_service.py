"""Broadcast service implementation."""

import secrets
from typing import Set

from loguru import logger
from redis import Redis
from rq import Queue

from app.core.config import settings
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.students import StudentRepository
from app.schemas.notifications import BroadcastCreate, BroadcastPreview


class BroadcastService:
    def __init__(self, session, tenant_id: int | None = None, tenant_schema: str | None = None):
        self.session = session
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema
        self.guardian_repo = GuardianRepository(session)
        self.student_repo = StudentRepository(session)
        self.redis = Redis.from_url(settings.redis_url)
        self.queue = Queue("broadcasts", connection=self.redis)

    def close(self) -> None:
        """R7-S5 fix: Close Redis connection to prevent leaks."""
        if self.redis:
            self.redis.close()

    async def _resolve_guardian_ids(self, payload: BroadcastCreate) -> Set[int]:
        audience = payload.audience
        guardian_ids: Set[int] = set()

        # R7-S6 fix: Use elif to prevent multiple scopes being processed
        if audience.scope.lower() == "global":
            guardians = await self.guardian_repo.list_all()
            guardian_ids.update(g.id for g in guardians)
        elif audience.scope.lower() == "course" and audience.course_ids:
            for course_id in audience.course_ids:
                students = await self.student_repo.list_by_course(course_id)
                g_list = await self.guardian_repo.list_by_student_ids([s.id for s in students])
                guardian_ids.update(g.id for g in g_list)
        elif audience.scope.lower() == "custom" and audience.guardian_ids:
            guardian_ids.update(audience.guardian_ids)

        return guardian_ids

    async def preview_broadcast(self, payload: BroadcastCreate) -> BroadcastPreview:
        guardian_ids = await self._resolve_guardian_ids(payload)
        return BroadcastPreview(
            subject=payload.subject,
            message=payload.message,
            recipients=len(guardian_ids),
            dry_run=True,
        )

    async def enqueue_broadcast(self, payload: BroadcastCreate) -> str:
        guardian_ids = list(await self._resolve_guardian_ids(payload))
        if not guardian_ids:
            raise ValueError("No hay destinatarios para el broadcast solicitado")
        job_id = secrets.token_hex(8)

        # R10-S8 fix: Log enqueue operations for debugging
        try:
            self.queue.enqueue(
                "app.workers.jobs.process_broadcast.process_broadcast_job",
                {
                    "job_id": job_id,
                    "payload": payload.model_dump(),
                    "guardian_ids": guardian_ids,
                    "tenant_id": self.tenant_id,
                    "tenant_schema": self.tenant_schema,
                },
                job_id=job_id,
            )
            logger.info(
                "Broadcast enqueued job_id=%s recipients=%d subject=%s",
                job_id,
                len(guardian_ids),
                payload.subject[:50] if payload.subject else "N/A",
            )
        except Exception as e:
            logger.error("Failed to enqueue broadcast job_id=%s error=%s", job_id, e)
            raise

        return job_id
