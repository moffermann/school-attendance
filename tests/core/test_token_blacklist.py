"""Tests for token blacklist module."""

import time
from unittest.mock import MagicMock, patch

from app.core.token_blacklist import TokenBlacklist


class TestTokenBlacklist:
    """Test cases for TokenBlacklist."""

    def test_hash_token_consistent(self):
        """Hashing same token should produce same result."""
        blacklist = TokenBlacklist()
        token = "test-token-123"
        hash1 = blacklist._hash_token(token)
        hash2 = blacklist._hash_token(token)
        assert hash1 == hash2
        assert len(hash1) == 32

    def test_hash_token_different_tokens(self):
        """Different tokens should produce different hashes."""
        blacklist = TokenBlacklist()
        hash1 = blacklist._hash_token("token1")
        hash2 = blacklist._hash_token("token2")
        assert hash1 != hash2

    def test_add_and_check_memory_fallback(self):
        """Test add and check with memory fallback."""
        blacklist = TokenBlacklist()
        blacklist._redis_available = False

        token = "test-refresh-token"
        exp = int(time.time()) + 3600  # 1 hour from now

        assert not blacklist.is_blacklisted(token)
        blacklist.add(token, exp)
        assert blacklist.is_blacklisted(token)

    def test_expired_token_not_blacklisted(self):
        """Expired tokens should not be considered blacklisted."""
        blacklist = TokenBlacklist()
        blacklist._redis_available = False

        token = "expired-token"
        exp = int(time.time()) - 100  # Already expired

        blacklist.add(token, exp)
        assert not blacklist.is_blacklisted(token)

    def test_default_expiration(self):
        """Test default 7-day expiration when exp is None."""
        blacklist = TokenBlacklist()
        blacklist._redis_available = False

        token = "no-exp-token"
        blacklist.add(token, None)
        assert blacklist.is_blacklisted(token)

    def test_cleanup_expired_entries(self):
        """Memory store should clean up expired entries."""
        blacklist = TokenBlacklist()
        blacklist._redis_available = False

        # Add expired entry directly
        token_hash = blacklist._hash_token("old-token")
        blacklist._memory_store[token_hash] = int(time.time()) - 100

        # Trigger cleanup by adding new token
        blacklist.add("new-token", int(time.time()) + 3600)

        # Old token should be cleaned up
        assert token_hash not in blacklist._memory_store

    def test_is_blacklisted_cleans_expired(self):
        """is_blacklisted should clean up expired entries."""
        blacklist = TokenBlacklist()
        blacklist._redis_available = False

        token = "test-token"
        token_hash = blacklist._hash_token(token)

        # Add expired entry directly
        blacklist._memory_store[token_hash] = int(time.time()) - 100

        # Check should return False and clean up
        assert not blacklist.is_blacklisted(token)
        assert token_hash not in blacklist._memory_store

    @patch("app.core.token_blacklist.redis")
    def test_redis_add(self, mock_redis_module):
        """Test adding token with Redis available."""
        mock_redis = MagicMock()
        mock_redis.ping.return_value = True
        mock_redis_module.from_url.return_value = mock_redis

        blacklist = TokenBlacklist()
        blacklist._redis = mock_redis
        blacklist._redis_available = True

        token = "redis-token"
        exp = int(time.time()) + 3600

        blacklist.add(token, exp)
        mock_redis.setex.assert_called_once()

    @patch("app.core.token_blacklist.redis")
    def test_redis_is_blacklisted(self, mock_redis_module):
        """Test checking blacklist with Redis available."""
        mock_redis = MagicMock()
        mock_redis.ping.return_value = True
        mock_redis.exists.return_value = 1
        mock_redis_module.from_url.return_value = mock_redis

        blacklist = TokenBlacklist()
        blacklist._redis = mock_redis
        blacklist._redis_available = True

        assert blacklist.is_blacklisted("some-token")
        mock_redis.exists.assert_called_once()

    @patch("app.core.token_blacklist.redis")
    def test_redis_fallback_on_error(self, mock_redis_module):
        """Test fallback to memory when Redis fails."""
        mock_redis = MagicMock()
        mock_redis.ping.return_value = True
        mock_redis.setex.side_effect = Exception("Redis error")
        mock_redis_module.from_url.return_value = mock_redis

        blacklist = TokenBlacklist()
        blacklist._redis = mock_redis
        blacklist._redis_available = True

        token = "fallback-token"
        exp = int(time.time()) + 3600

        # Should not raise, should fall back to memory
        blacklist.add(token, exp)

        # Check in memory
        blacklist._redis_available = False
        assert blacklist.is_blacklisted(token)
