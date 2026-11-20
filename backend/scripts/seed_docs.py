"""Seed live /docs module — DocsConfig + TeamMember.

Idempotent: only creates default DocsConfig if none exists, and adds
placeholder team members if table is empty.

Usage:
  DATABASE_URL=postgresql+asyncpg://... python backend/scripts/seed_docs.py
  # Docker: docker compose exec backend python scripts/seed_docs.py
  # Local SQLite: python scripts/seed_docs.py  (uses sqlite+aiosqlite:///./xpay.db)
"""

import asyncio
import datetime
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from sqlalchemy import select

from app.db.database import AsyncSessionLocal, Base, engine
from app.models.docs import DocsConfig, TeamMember


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # DocsConfig — single row
        result = await db.execute(select(DocsConfig).limit(1))
        cfg = result.scalars().first()
        if not cfg:
            now = datetime.datetime.now(datetime.timezone.utc)
            cfg = DocsConfig(
                is_public=True,
                start_time=now,
                end_time=now + datetime.timedelta(days=30),
            )
            db.add(cfg)
            await db.commit()
            print(f"Seeded DocsConfig: public=True, {cfg.start_time} -> {cfg.end_time}")
        else:
            print(f"DocsConfig exists: public={cfg.is_public}, {cfg.start_time} -> {cfg.end_time}")

        # TeamMember — placeholders if empty, plus ensure Tanu exists
        result = await db.execute(select(TeamMember))
        members = result.scalars().all()
        if not members:
            placeholders = [
                TeamMember(name="Taskifbin", role="Creator & Full-Stack", email="taskifbin@example.com", image_url=None, order_index=0),
                TeamMember(name="xPay Team", role="AI & Fintech", email="team@xpay.example.com", image_url=None, order_index=1),
                TeamMember(name="Tanu Sen Riya", role="NRB Product Lead (India Corridor)", email="tanu@xpay.example.com", image_url=None, order_index=2),
            ]
            for m in placeholders:
                db.add(m)
            await db.commit()
            print(f"Seeded {len(placeholders)} TeamMember(s)")
        else:
            # Ensure Tanu exists even if table already has data (idempotent)
            emails = {m.email for m in members}
            if "tanu@xpay.example.com" not in emails:
                tanu = TeamMember(name="Tanu Sen Riya", role="NRB Product Lead (India Corridor)", email="tanu@xpay.example.com", image_url=None, order_index=2)
                db.add(tanu)
                await db.commit()
                print("Seeded Tanu Sen Riya (NRB Product Lead)")
            else:
                print(f"TeamMember exists: {len(members)} row(s) — Tanu already present")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
