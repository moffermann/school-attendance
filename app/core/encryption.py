"""Encryption utilities for sensitive tenant data."""

from __future__ import annotations

import base64
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """Get or create a Fernet instance with the configured key."""
    key = settings.encryption_key

    # If key is not base64 encoded, encode it
    try:
        # Try to use directly as Fernet key
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # If that fails, try to create a key from the string
        # Fernet keys must be 32 url-safe base64-encoded bytes
        key_bytes = key.encode() if isinstance(key, str) else key
        # Pad or truncate to 32 bytes
        key_bytes = key_bytes[:32].ljust(32, b"=")
        encoded_key = base64.urlsafe_b64encode(key_bytes)
        return Fernet(encoded_key)


def encrypt(plaintext: str) -> bytes:
    """
    Encrypt a string using Fernet symmetric encryption.

    Args:
        plaintext: The string to encrypt

    Returns:
        Encrypted bytes
    """
    if not plaintext:
        return b""

    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode())


def decrypt(ciphertext: bytes) -> str:
    """
    Decrypt bytes using Fernet symmetric encryption.

    Args:
        ciphertext: The encrypted bytes

    Returns:
        Decrypted string

    Raises:
        ValueError: If decryption fails
    """
    if not ciphertext:
        return ""

    try:
        fernet = _get_fernet()
        return fernet.decrypt(ciphertext).decode()
    except InvalidToken as e:
        logger.error("Decryption failed: invalid token")
        raise ValueError("Failed to decrypt data: invalid key or corrupted data") from e
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError(f"Failed to decrypt data: {e}") from e


def encrypt_if_present(value: str | None) -> bytes | None:
    """Encrypt a value only if it's not None or empty."""
    if value:
        return encrypt(value)
    return None


def decrypt_if_present(value: bytes | None) -> str | None:
    """Decrypt a value only if it's not None or empty."""
    if value:
        return decrypt(value)
    return None
