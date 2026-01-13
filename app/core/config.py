"""Application configuration via Pydantic settings."""

from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = Field("development", env="APP_ENV")
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8000, env="API_PORT")

    # Security: SECRET_KEY is required in production (no default)
    # In development, a default is provided but should be overridden
    secret_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION",
        env="SECRET_KEY",
        description="JWT signing key - MUST be changed in production"
    )
    jwt_access_expires_min: int = Field(15, env="JWT_ACCESS_EXPIRES_MIN")
    jwt_refresh_expires_days: int = Field(7, env="JWT_REFRESH_EXPIRES_DAYS")

    database_url: str = Field("postgresql+asyncpg://user:pass@localhost:5432/db", env="DATABASE_URL")
    redis_url: str = Field("redis://localhost:6379/0", env="REDIS_URL")

    s3_endpoint: str = Field("http://localhost:9000", env="S3_ENDPOINT")
    s3_public_url: str | None = Field(
        None,
        env="S3_PUBLIC_URL",
        description="Public URL for S3/MinIO (for presigned URLs accessible from external devices)"
    )
    s3_bucket: str = Field("attendance-photos", env="S3_BUCKET")
    s3_access_key: str = Field("dev-access", env="S3_ACCESS_KEY")
    s3_secret_key: str = Field("dev-secret", env="S3_SECRET_KEY")
    s3_region: str = Field("us-east-1", env="S3_REGION")
    s3_secure: bool = Field(False, env="S3_SECURE")
    photo_retention_days: int = Field(60, env="PHOTO_RETENTION_DAYS")

    whatsapp_access_token: str = Field("dummy", env="WHATSAPP_ACCESS_TOKEN")
    whatsapp_phone_number_id: str = Field("dummy", env="WHATSAPP_PHONE_NUMBER_ID")
    ses_region: str = Field("us-east-1", env="SES_REGION")
    ses_source_email: str = Field("no-reply@example.com", env="SES_SOURCE_EMAIL")

    # Email provider selection: "ses" (AWS) or "smtp" (generic)
    email_provider: str = Field(
        default="ses",
        env="EMAIL_PROVIDER",
        description="Email provider: 'ses' for AWS SES, 'smtp' for generic SMTP (Gmail, etc.)"
    )

    # SMTP Configuration (for Gmail, Google Workspace, Outlook, etc.)
    smtp_host: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_user: str = Field(default="", env="SMTP_USER")
    smtp_password: str = Field(default="", env="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, env="SMTP_USE_TLS")
    smtp_from_name: str = Field(
        default="Sistema de Asistencia",
        env="SMTP_FROM_NAME",
        description="Display name for outgoing emails"
    )

    rate_limit_default: str = Field("100/minute", env="RATE_LIMIT_DEFAULT")
    enable_real_notifications: bool = Field(False, env="ENABLE_REAL_NOTIFICATIONS")

    cors_origins: list[AnyHttpUrl] = Field(default_factory=list, env="CORS_ORIGINS")
    public_base_url: AnyHttpUrl = Field("http://localhost:8000", env="PUBLIC_BASE_URL")
    no_show_grace_minutes: int = Field(15, env="NO_SHOW_GRACE_MINUTES")

    # Security: DEVICE_API_KEY is required in production (no default)
    device_api_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION",
        env="DEVICE_API_KEY",
        description="Kiosk device authentication key - MUST be changed in production"
    )

    # WebAuthn / Passkeys configuration for biometric authentication
    webauthn_rp_id: str = Field(
        default="localhost",
        env="WEBAUTHN_RP_ID",
        description="Relying Party ID - must be the domain (e.g., 'escuela.cl')"
    )
    webauthn_rp_name: str = Field(
        default="Sistema de Asistencia Escolar",
        env="WEBAUTHN_RP_NAME",
        description="Human-readable name shown to users during authentication"
    )
    webauthn_rp_origin: str = Field(
        default="http://localhost:8000",
        env="WEBAUTHN_RP_ORIGIN",
        description="Full origin URL (e.g., 'https://escuela.cl')"
    )
    webauthn_timeout_ms: int = Field(
        default=60000,
        env="WEBAUTHN_TIMEOUT_MS",
        description="Timeout for WebAuthn operations in milliseconds"
    )

    # Web Push Notifications (VAPID)
    # Generate keys: npx web-push generate-vapid-keys
    vapid_private_key: str = Field(
        default="",
        env="VAPID_PRIVATE_KEY",
        description="VAPID private key for Web Push (base64)"
    )
    vapid_public_key: str = Field(
        default="",
        env="VAPID_PUBLIC_KEY",
        description="VAPID public key for Web Push (base64)"
    )
    vapid_subject: str = Field(
        default="mailto:admin@school.cl",
        env="VAPID_SUBJECT",
        description="VAPID subject (mailto: or https: URL)"
    )

    # Multi-tenant configuration
    default_tenant_slug: str | None = Field(
        default=None,
        env="DEFAULT_TENANT_SLUG",
        description="Default tenant slug for development (e.g., 'demo'). Only used if APP_ENV=development"
    )
    skip_tenant_middleware: bool = Field(
        default=False,
        env="SKIP_TENANT_MIDDLEWARE",
        description="Skip tenant resolution (for testing without PostgreSQL)"
    )
    encryption_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION-32BYTES!",
        env="ENCRYPTION_KEY",
        description="Fernet encryption key for tenant credentials. Must be 32 url-safe base64 chars."
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

    class Config:
        env_file = ".env"
        case_sensitive = False
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings(**overrides: Any) -> Settings:
    if overrides:
        return Settings(**overrides)
    return Settings()


settings = get_settings()
