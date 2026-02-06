"""Token blacklist for JWT revocation.

This module provides a simple in-memory token blacklist with Redis support.
Tokens are stored until their expiration time, then automatically cleaned up.
"""

import hashlib
import time

import redis
from loguru import logger

from app.core.config import settings


class TokenBlacklist:
    """Token blacklist with Redis backend and in-memory fallback."""

    # Maximum entries in memory store to prevent unbounded growth
    MAX_MEMORY_ENTRIES = 10000

    def __init__(self):
        self._memory_store: dict[str, int] = {}  # hash -> expiration timestamp
        self._redis: redis.Redis | None = None
        self._redis_available = False
        self._last_cleanup = 0
        self._init_redis()

    def _init_redis(self) -> None:
        """Initialize Redis connection if available."""
        try:
            redis_conn: redis.Redis = redis.from_url(settings.redis_url, decode_responses=True)  # type: ignore[assignment]
            redis_conn.ping()
            self._redis = redis_conn
            self._redis_available = True
        except Exception:
            self._redis_available = False

    def _hash_token(self, token: str) -> str:
        """Hash token for storage (don't store raw tokens)."""
        return hashlib.sha256(token.encode()).hexdigest()[:32]

    def add(self, token: str, exp: int | None = None) -> None:
        """Add a token to the blacklist.

        Args:
            token: The JWT token to blacklist
            exp: Token expiration timestamp. If None, uses 7 days default.
        """
        token_hash = self._hash_token(token)

        # Calculate TTL (time until token expires)
        if exp is None:
            ttl = 7 * 24 * 3600  # 7 days default
        else:
            ttl = max(0, exp - int(time.time()))

        if ttl <= 0:
            return  # Token already expired, no need to blacklist

        if self._redis_available and self._redis:
            try:
                self._redis.setex(f"blacklist:{token_hash}", ttl, "1")
                return
            except Exception as exc:
                # R13-ERR1 fix: Log Redis failures for debugging
                logger.warning("Redis blacklist write failed, using memory fallback: %s", exc)

        # In-memory fallback
        self._memory_store[token_hash] = int(time.time()) + ttl
        self._cleanup_memory()

    def is_blacklisted(self, token: str) -> bool:
        """Check if a token is blacklisted.

        Args:
            token: The JWT token to check

        Returns:
            True if token is blacklisted, False otherwise
        """
        token_hash = self._hash_token(token)

        if self._redis_available and self._redis:
            try:
                return self._redis.exists(f"blacklist:{token_hash}") > 0  # type: ignore[operator]
            except Exception as exc:
                # R13-ERR1 fix: Log Redis failures for debugging
                logger.warning("Redis blacklist read failed, using memory fallback: %s", exc)

        # Periodic cleanup during reads (low overhead due to time check)
        self._cleanup_memory()

        # In-memory check
        exp = self._memory_store.get(token_hash)
        if exp is None:
            return False
        if exp < int(time.time()):
            del self._memory_store[token_hash]
            return False
        return True

    def _cleanup_memory(self, force: bool = False) -> None:
        """Remove expired entries from memory store.

        Args:
            force: Force cleanup even if not due (for size limits)
        """
        now = int(time.time())

        # Only run cleanup every 60 seconds unless forced
        if not force and now - self._last_cleanup < 60:
            return

        self._last_cleanup = now

        # Remove expired entries
        expired = [k for k, v in self._memory_store.items() if v < now]
        for k in expired:
            del self._memory_store[k]

        # If still over limit, remove oldest entries
        if len(self._memory_store) > self.MAX_MEMORY_ENTRIES:
            # Sort by expiration time (oldest first) and remove excess
            sorted_entries = sorted(self._memory_store.items(), key=lambda x: x[1])
            excess = len(self._memory_store) - self.MAX_MEMORY_ENTRIES
            for k, _ in sorted_entries[:excess]:
                del self._memory_store[k]


# Singleton instance
token_blacklist = TokenBlacklist()


# TDD-BUG3.4 fix: Convenience functions for easier access
def add_to_blacklist(token: str, exp: int | None = None) -> None:
    """Add a token to the blacklist.

    Args:
        token: The JWT token to blacklist
        exp: Token expiration timestamp
    """
    token_blacklist.add(token, exp)


def is_blacklisted(token: str) -> bool:
    """Check if a token is blacklisted.

    Args:
        token: The JWT token to check

    Returns:
        True if token is blacklisted
    """
    return token_blacklist.is_blacklisted(token)


def clear_blacklist() -> None:
    """Clear all entries from the blacklist (for testing)."""
    token_blacklist._memory_store.clear()
