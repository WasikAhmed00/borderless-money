"""Seed TeamMember — adds Tanu Sen Riya (Backend Engineer).

Idempotent: only inserts if email not already present.

Usage:
  DATABASE_URL=postgresql+asyncpg://... python backend/scripts/seed_team.py
  # or
  python backend/scripts/seed_team.py  # uses sqlite+aiosqlite:///./xpay.db fallback
"""

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from sqlalchemy import select

from app.db.database import AsyncSessionLocal, Base, engine
from app.models.docs import TeamMember


async def seed_tanu():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TeamMember).where(TeamMember.email == "tanu@xpay.example.com"))
        existing = result.scalars().first()
        if existing:
            print(f"Tanu already exists: id={existing.id} {existing.name} ({existing.role})")
            return

        tanu = TeamMember(
            name="Tanu Sen Riya",
            role="Backend Engineer",
            email="tanu@xpay.example.com",
            image_url=None,
            order_index=2,
        )
        db.add(tanu)
        await db.commit()
        await db.refresh(tanu)
        print(f"Seeded Tanu Sen Riya: id={tanu.id} {tanu.email} — Backend Engineer")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_tanu())
