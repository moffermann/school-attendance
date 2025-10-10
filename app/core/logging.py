"""Structured logging helpers."""

from __future__ import annotations

import logging
import sys
from typing import Any

from loguru import logger


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
    logger.add(sys.stderr, level="INFO", enqueue=True, backtrace=True, diagnose=False)
