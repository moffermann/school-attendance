"""Application configuration via Pydantic settings."""

from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Field names are automatically mapped to uppercase env vars:
    - app_env -> APP_ENV
    - database_url -> DATABASE_URL
    etc.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Security: SECRET_KEY is required in production (no default)
    # In development, a default is provided but should be overridden
    secret_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION",
        description="JWT signing key - MUST be changed in production",
    )
    jwt_access_expires_min: int = 15
    jwt_refresh_expires_days: int = 7

    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/db"
    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint: str = "http://localhost:9000"
    s3_public_url: str | None = Field(
        default=None,
        description="Public URL for S3/MinIO (for presigned URLs accessible from external devices)",
    )
    s3_bucket: str = "attendance-photos"
    s3_access_key: str = "dev-access"
    s3_secret_key: str = "dev-secret"
    s3_region: str = "us-east-1"
    s3_secure: bool = False
    photo_retention_days: int = 60

    whatsapp_access_token: str = "dummy"
    whatsapp_phone_number_id: str = "dummy"
    ses_region: str = "us-east-1"
    ses_source_email: str = "no-reply@example.com"

    # Email provider selection: "ses" (AWS) or "smtp" (generic)
    email_provider: str = Field(
        default="ses",
        description="Email provider: 'ses' for AWS SES, 'smtp' for generic SMTP (Gmail, etc.)",
    )

    # SMTP Configuration (for Gmail, Google Workspace, Outlook, etc.)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_name: str = Field(
        default="Sistema de Asistencia", description="Display name for outgoing emails"
    )

    rate_limit_default: str = "100/minute"
    enable_real_notifications: bool = False

    cors_origins: list[AnyHttpUrl] = Field(default_factory=list)
    public_base_url: AnyHttpUrl = "http://localhost:8000"  # type: ignore[assignment]
    no_show_grace_minutes: int = 15

    # Security: DEVICE_API_KEY is required in production (no default)
    device_api_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION",
        description="Kiosk device authentication key - MUST be changed in production",
    )

    # WebAuthn / Passkeys configuration for biometric authentication
    webauthn_rp_id: str = Field(
        default="localhost",
        description="Relying Party ID - must be the domain (e.g., 'escuela.cl')",
    )
    webauthn_rp_name: str = Field(
        default="Sistema de Asistencia Escolar",
        description="Human-readable name shown to users during authentication",
    )
    webauthn_rp_origin: str = Field(
        default="http://localhost:8000", description="Full origin URL (e.g., 'https://escuela.cl')"
    )
    webauthn_timeout_ms: int = Field(
        default=60000, description="Timeout for WebAuthn operations in milliseconds"
    )

    # Web Push Notifications (VAPID)
    # Generate keys: npx web-push generate-vapid-keys
    vapid_private_key: str = Field(
        default="", description="VAPID private key for Web Push (base64)"
    )
    vapid_public_key: str = Field(default="", description="VAPID public key for Web Push (base64)")
    vapid_subject: str = Field(
        default="mailto:admin@school.cl", description="VAPID subject (mailto: or https: URL)"
    )

    # Multi-tenant configuration
    default_tenant_slug: str | None = Field(
        default=None,
        description=(
            "Default tenant slug for development (e.g., 'demo'). "
            "Only used if APP_ENV=development"
        ),
    )
    skip_tenant_middleware: bool = Field(
        default=False, description="Skip tenant resolution (for testing without PostgreSQL)"
    )
    encryption_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION-32BYTES!",
        description=(
            "Fernet encryption key for tenant credentials. "
            "Must be 32 url-safe base64 chars."
        ),
    )

    # Feature flags for sequence validation and notification deduplication
    enable_sequence_validation: bool = Field(
        default=True,
        description="Enable server-side IN/OUT sequence validation and auto-correction",
    )
    enable_notification_dedup: bool = Field(
        default=True, description="Enable notification deduplication (1 per type/student/day)"
    )

    # Timezone configuration for display (notifications, reports)
    school_timezone: str = Field(
        default="America/Santiago",
        description="Timezone for displaying times in notifications (IANA timezone name)",
    )

    def validate_production_secrets(self) -> list[str]:
        """Check if secrets are using insecure defaults.

        R5-D6 fix: In production, raises ValueError instead of just warning.
        Returns list of warnings for non-production environments.
        """
        warnings = []
        if self.app_env == "production":
            if self.secret_key == "CHANGE-ME-IN-PRODUCTION":
                raise ValueError("SECRET_KEY must be changed from default in production!")
            if self.device_api_key == "CHANGE-ME-IN-PRODUCTION":
                raise ValueError("DEVICE_API_KEY must be changed from default in production!")
            if self.encryption_key == "CHANGE-ME-IN-PRODUCTION-32BYTES!":
                raise ValueError("ENCRYPTION_KEY must be changed from default in production!")
        else:
            # Only warn in non-production
            if self.secret_key == "CHANGE-ME-IN-PRODUCTION":
                warnings.append("SECRET_KEY is using default value")
            if self.device_api_key == "CHANGE-ME-IN-PRODUCTION":
                warnings.append("DEVICE_API_KEY is using default value")
            if self.encryption_key == "CHANGE-ME-IN-PRODUCTION-32BYTES!":
                warnings.append("ENCRYPTION_KEY is using default value")
        return warnings


@lru_cache
def get_settings(**overrides: Any) -> Settings:
    if overrides:
        return Settings(**overrides)
    return Settings()


settings = get_settings()
