"""Application settings loaded from environment variables.

Secrets (SECRET_KEY, DATABASE_URL) have NO defaults on purpose: if they are
missing the app fails fast at startup instead of running with insecure values.
"""
from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Required secrets (no default -> fail fast if unset) ---
    SECRET_KEY: str
    DATABASE_URL: str

    # --- Auth / JWT ---
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS (comma-separated origins) ---
    CORS_ORIGINS: str = "http://localhost:5173"

    @cached_property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]
