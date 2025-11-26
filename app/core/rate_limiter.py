"""Rate limiter configuration."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Global rate limiter instance
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])
