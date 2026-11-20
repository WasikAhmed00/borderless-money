"""Core settings — loads DATABASE_URL via pydantic-settings.

All database interactions MUST use AsyncSession (see app/db/database.py).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Async URL for SQLAlchemy + asyncpg
    # Docker Compose: postgresql+asyncpg://postgres:postgres@db:5432/xpay
    # Local fallback (if postgres not running): postgresql+asyncpg://postgres:postgres@localhost:5432/xpay
    # CI will inject DATABASE_URL via env
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/xpay"

    # Sync URL for Alembic (psycopg2) — derived from async URL if not set
    # Alembic runs sync, so it needs postgresql+psycopg2://
    SYNC_DATABASE_URL: str | None = None

    # JWT (kept here for single source; auth.py also reads env directly for compat)
    XPAY_JWT_SECRET: str = "CHANGE_ME_SECRET_KEY_XPAY_DEMO_INSECURE_32CHARS_DO_NOT_USE_IN_PROD"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def sync_url(self) -> str:
        if self.SYNC_DATABASE_URL:
            return self.SYNC_DATABASE_URL
        # Convert asyncpg URL to psycopg2 for Alembic
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


settings = Settings()
