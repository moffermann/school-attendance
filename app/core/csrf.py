"""CSRF protection for session-based authentication."""

import secrets

from fastapi import HTTPException, Request, status

CSRF_TOKEN_LENGTH = 32
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH)


def get_csrf_token_from_request(request: Request) -> str | None:
    """Extract CSRF token from request header."""
    return request.headers.get(CSRF_HEADER_NAME)


def get_csrf_token_from_cookie(request: Request) -> str | None:
    """Extract CSRF token from cookie."""
    return request.cookies.get(CSRF_COOKIE_NAME)


def validate_csrf_token(request: Request) -> None:
    """Validate CSRF token matches between cookie and header.

    For state-changing requests (POST, PUT, DELETE, PATCH) with session cookies,
    the CSRF token in the header must match the one in the cookie.

    Raises:
        HTTPException: If CSRF validation fails
    """
    # Only validate for session-based requests (those with session_token cookie)
    if not request.cookies.get("session_token"):
        return  # API token auth, no CSRF needed

    cookie_token = get_csrf_token_from_cookie(request)
    header_token = get_csrf_token_from_request(request)

    if not cookie_token or not header_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token CSRF faltante")

    if not secrets.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token CSRF inválido")
