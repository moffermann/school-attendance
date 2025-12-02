"""FastAPI application entry point."""

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.rate_limiter import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.web.router import web_router

logger = logging.getLogger(__name__)

# Base directory for frontend apps
FRONTEND_BASE = Path(__file__).parent.parent / "src"


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
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security headers middleware
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS: Restrictive configuration for production
    allowed_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allowed_headers = [
        "Authorization",
        "Content-Type",
        "X-Device-Key",
        "X-Requested-With",
        "Accept",
        "Origin",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins if settings.cors_origins else ["*"] if settings.app_env == "development" else [],
        allow_credentials=True,
        allow_methods=allowed_methods,
        allow_headers=allowed_headers,
    )

    # Legacy static mount for web portal templates
    app.mount("/static", StaticFiles(directory="app/web/static"), name="static")

    # Mount frontend SPAs (only if directories exist)
    if (FRONTEND_BASE / "kiosk-app").exists():
        app.mount("/kiosk", StaticFiles(directory=str(FRONTEND_BASE / "kiosk-app"), html=True), name="kiosk")
    if (FRONTEND_BASE / "teacher-pwa").exists():
        app.mount("/teacher", StaticFiles(directory=str(FRONTEND_BASE / "teacher-pwa"), html=True), name="teacher")
    if (FRONTEND_BASE / "web-app").exists():
        app.mount("/app", StaticFiles(directory=str(FRONTEND_BASE / "web-app"), html=True), name="webapp")

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
