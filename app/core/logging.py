"""Structured logging helpers."""

from __future__ import annotations

import logging
import sys
from typing import Any

from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:  # pragma: no cover - thin adapter
        logger_opt = logger.opt(depth=6, exception=record.exc_info)
        logger_opt.log(record.levelname, record.getMessage())


def setup_logging() -> None:
    """Configure loguru to handle standard logging calls."""

    logging.getLogger().handlers = [InterceptHandler()]
    logging.getLogger("uvicorn").handlers = [InterceptHandler()]
    logging.getLogger("uvicorn.access").handlers = [InterceptHandler()]

    logger.remove()
    # R8-C7 fix: Disable backtrace in production to avoid exposing sensitive info
    enable_backtrace = settings.app_env != "production"
    logger.add(sys.stderr, level="INFO", enqueue=True, backtrace=enable_backtrace, diagnose=False)
