"""One-off migration: users.json → PostgreSQL `users` table.

Reads backend/data/users.json, checks if passwords are already hashed
(bcrypt $2b$ prefix), hashes plain text if needed, and inserts into DB.

Usage:
  DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/xpay \
    python backend/scripts/migrate_json_to_db.py

Or via Docker:
  docker compose exec backend python scripts/migrate_json_to_db.py

Idempotent: skips existing emails (ON CONFLICT DO NOTHING equivalent via select check).
"""

import asyncio
import json
import sys
from pathlib import Path

# Ensure backend is on path when run as `python backend/scripts/...`
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from passlib.context import CryptContext  # reuse same hashing as auth.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import AsyncSessionLocal, Base, engine
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
USERS_JSON = BACKEND / "data" / "users.json"


def is_hashed(pw: str) -> bool:
    return pw.startswith("$2a$") or pw.startswith("$2b$") or pw.startswith("$2y$")


async def migrate():
    # Ensure tables exist (if alembic not yet run, create via metadata)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Load JSON
    if not USERS_JSON.exists():
        print(f"No {USERS_JSON} found — nothing to migrate")
        return

    with open(USERS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print(f"Unexpected format in {USERS_JSON}: expected list")
        return

    migrated = 0
    skipped = 0
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        for entry in data:
            email = entry.get("email", "").lower().strip()
            role = entry.get("role", "user")
            raw_pw = entry.get("hashed_password") or entry.get("password") or ""

            if not email or not raw_pw:
                print(f"Skipping invalid entry: {entry}")
                continue

            # Check existing
            existing = await db.execute(select(User).where(User.email == email))
            if existing.scalars().first():
                print(f"Skipping {email} — already exists")
                skipped += 1
                continue

            # Hash if plain text, else keep existing hash
            if is_hashed(raw_pw):
                hashed = raw_pw
                print(f"Using existing hash for {email} ({role})")
            else:
                hashed = pwd_context.hash(raw_pw)
                print(f"Hashed plain password for {email} ({role})")

            user = User(email=email, hashed_password=hashed, role=role)
            db.add(user)
            migrated += 1

        await db.commit()
    print(f"\nDone: {migrated} migrated, {skipped} skipped. DB: {settings.DATABASE_URL.split('@')[-1]}")


if __name__ == "__main__":
    asyncio.run(migrate())
