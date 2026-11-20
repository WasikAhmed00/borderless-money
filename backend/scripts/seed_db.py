"""Seed PostgreSQL `users` table with default demo users (idempotent).

Replaces the legacy users.json file. PostgreSQL is now the single source of truth.

Hardcoded demo credentials (hashed dynamically at runtime via passlib+bcrypt):
  admin@xpay.com / AdminPass123! (admin)
  user@xpay.com  / UserPass123!  (user)
  guest@xpay.com / GuestPass123! (guest)

Usage:
  DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/xpay python backend/scripts/seed_db.py
  # Docker: docker compose exec backend python scripts/seed_db.py
  # Local SQLite fallback: python scripts/seed_db.py  (uses sqlite+aiosqlite:///./xpay.db)

Idempotent: checks select(User).where(User.email == email) before insert.
"""

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from passlib.context import CryptContext
from sqlalchemy import select

from app.db.database import AsyncSessionLocal, Base, engine
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_USERS = [
    {"email": "admin@xpay.com", "password": "AdminPass123!", "role": "admin"},
    {"email": "user@xpay.com", "password": "UserPass123!", "role": "user"},
    {"email": "guest@xpay.com", "password": "GuestPass123!", "role": "guest"},
]


async def seed():
    # Ensure tables exist (no-op if alembic already ran)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    seeded = 0
    skipped = 0
    async with AsyncSessionLocal() as db:
        for u in DEMO_USERS:
            email = u["email"].lower().strip()
            # Idempotency: skip if exists
            result = await db.execute(select(User).where(User.email == email))
            existing = result.scalars().first()
            if existing:
                print(f"Skipping {email} — already exists ({existing.role})")
                skipped += 1
                continue

            hashed = pwd_context.hash(u["password"])
            # Verify round-trip (defensive)
            assert pwd_context.verify(u["password"], hashed), f"Hash verify failed for {email}"
            user = User(email=email, hashed_password=hashed, role=u["role"])
            db.add(user)
            print(f"Seeding {email} ({u['role']})")

            seeded += 1

        await db.commit()

    # Use settings to show which DB was used (without leaking password)
    try:
        from app.core.config import settings

        db_label = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL
    except Exception:
        db_label = "unknown"

    print(f"\nDone: {seeded} seeded, {skipped} skipped. DB: {db_label}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
