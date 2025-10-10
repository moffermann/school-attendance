"""Application configuration via Pydantic settings."""

from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = Field("development", env="APP_ENV")
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8000, env="API_PORT")

    secret_key: str = Field("dev-secret", env="SECRET_KEY")
    jwt_access_expires_min: int = Field(15, env="JWT_ACCESS_EXPIRES_MIN")
    jwt_refresh_expires_days: int = Field(7, env="JWT_REFRESH_EXPIRES_DAYS")

    database_url: str = Field("postgresql+asyncpg://user:pass@localhost:5432/db", env="DATABASE_URL")
    redis_url: str = Field("redis://localhost:6379/0", env="REDIS_URL")

    s3_endpoint: str = Field("http://localhost:9000", env="S3_ENDPOINT")
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

    rate_limit_default: str = Field("100/minute", env="RATE_LIMIT_DEFAULT")
    enable_real_notifications: bool = Field(False, env="ENABLE_REAL_NOTIFICATIONS")

    cors_origins: list[AnyHttpUrl] = Field(default_factory=list, env="CORS_ORIGINS")
    public_base_url: AnyHttpUrl = Field("http://localhost:8000", env="PUBLIC_BASE_URL")
    no_show_grace_minutes: int = Field(15, env="NO_SHOW_GRACE_MINUTES")
    device_api_key: str = Field("device-secret", env="DEVICE_API_KEY")

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
