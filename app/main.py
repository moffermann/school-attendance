"""FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.web.router import web_router

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])


def create_app() -> FastAPI:
    """Application factory for FastAPI."""

    setup_logging()

    # Validate security settings on startup
    security_warnings = settings.validate_production_secrets()
    for warning in security_warnings:
        logger.critical(f"SECURITY WARNING: {warning}")

    app = FastAPI(
        title="School Attendance API",
        version="0.1.0",
        description="MVP para control de ingreso/salida escolar",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
    )

    app.state.limiter = limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/static", StaticFiles(directory="app/web/static"), name="static")

    app.include_router(api_router, prefix="/api/v1")
    app.include_router(web_router)

    return app


app = create_app()


@app.get("/health", tags=["health"])
async def healthcheck() -> dict[str, str]:
    """Simple health endpoint."""

    return {"status": "ok"}


@app.get("/healthz", tags=["health"])
async def healthcheck_z() -> dict[str, str]:
    """Alias for container health probes."""

    return {"status": "ok"}
