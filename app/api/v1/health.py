"""Health endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping", summary="Healthcheck básico")
async def ping() -> dict[str, str]:
    return {"status": "ok"}
