"""Async SQLAlchemy 2.0 engine + session.

All database interactions MUST use AsyncSession (AGENT.md rule).
No synchronous SQLAlchemy is used in the app path.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Async engine — psycopg + asyncpg driver
# echo=False in prod; set in env for debug
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

# Session factory — every request gets its own AsyncSession
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Declarative base for all models (User, Transaction, Quote, etc.)."""
    pass


async def get_db():
    """FastAPI dependency — yields an AsyncSession and closes it after request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables (used for local dev without Alembic, and for tests)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose engine (called on app shutdown)."""
    await engine.dispose()
