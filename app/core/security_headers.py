"""Security headers middleware."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy (restrict browser features)
        response.headers["Permissions-Policy"] = (
            "camera=(self), "
            "microphone=(self), "
            "geolocation=(), "
            "payment=()"
        )

        # Content Security Policy for API responses
        # More restrictive for API, relaxed for HTML pages
        if request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none'"
            )

        # Strict Transport Security (HTTPS only)
        # Only set in production to avoid issues with local development
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
