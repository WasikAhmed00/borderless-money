"""Core settings — loads DATABASE_URL via pydantic-settings.

All database interactions MUST use AsyncSession (see app/db/database.py).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Async URL for SQLAlchemy
    # Docker Compose overrides to: postgresql+asyncpg://postgres:postgres@db:5432/xpay
    # CI sets: postgresql+asyncpg://postgres:postgres@localhost:5432/xpay
    # Local dev without Docker falls back to SQLite (no Postgres needed) — still AsyncSession
    DATABASE_URL: str = "sqlite+aiosqlite:///./xpay.db"

    # Sync URL for Alembic — derived from async URL if not set
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
        # Convert async URL to sync for Alembic offline
        if "sqlite+aiosqlite" in self.DATABASE_URL:
            return self.DATABASE_URL.replace("sqlite+aiosqlite://", "sqlite://")
        if "postgresql+asyncpg" in self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        return self.DATABASE_URL


settings = Settings()
