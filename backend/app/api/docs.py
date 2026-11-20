"""Live /docs API — PostgreSQL source of truth (no JSON).

Provides:
  GET  /api/docs/config    — public, scheduling window
  GET  /api/docs/live-data — public, dashboard metrics (exact Decimal for money)
  GET  /api/docs/team      — public, team grid
  PUT  /api/docs/config    — admin only
  POST /api/docs/team      — admin only
  DELETE /api/docs/team/{id} — admin only

All DB ops use AsyncSession (SQLAlchemy 2.0 + asyncpg).
All financial figures use exact Decimal before serialization.
"""

import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.db.database import get_db
from app.models.docs import DocsConfig, TeamMember
from app.models.user import User

router = APIRouter(prefix="/api/docs", tags=["docs"])


# --- Helpers ---

async def get_or_create_config(db: AsyncSession) -> DocsConfig:
    result = await db.execute(select(DocsConfig).limit(1))
    cfg = result.scalars().first()
    if cfg:
        return cfg
    # Create default: is_public=True, window now -> now+30d
    now = datetime.datetime.now(datetime.timezone.utc)
    cfg = DocsConfig(
        is_public=True,
        start_time=now,
        end_time=now + datetime.timedelta(days=30),
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg


def is_within_window(cfg: DocsConfig, now: Optional[datetime.datetime] = None) -> bool:
    if now is None:
        now = datetime.datetime.now(datetime.timezone.utc)
    # Ensure cfg times are timezone-aware
    start = cfg.start_time
    end = cfg.end_time
    if start is not None and start.tzinfo is None:
        start = start.replace(tzinfo=datetime.timezone.utc)
    if end is not None and end.tzinfo is None:
        end = end.replace(tzinfo=datetime.timezone.utc)
    if start and now < start:
        return False
    if end and now > end:
        return False
    return True


# --- Schemas ---

class DocsConfigOut(BaseModel):
    is_public: bool
    start_time: Optional[datetime.datetime]
    end_time: Optional[datetime.datetime]

    class Config:
        from_attributes = True


class DocsConfigIn(BaseModel):
    is_public: bool = Field(..., description="Whether docs are public")
    start_time: Optional[datetime.datetime] = Field(None, description="Window start (ISO 8601)")
    end_time: Optional[datetime.datetime] = Field(None, description="Window end (ISO 8601)")


class TeamMemberOut(BaseModel):
    id: int
    name: str
    role: str
    email: str
    image_url: Optional[str]
    order_index: int

    class Config:
        from_attributes = True


class TeamMemberIn(BaseModel):
    name: str = Field(..., max_length=120)
    role: str = Field(..., max_length=120)
    email: str = Field(..., max_length=255)
    image_url: Optional[str] = Field(None, max_length=512)
    order_index: int = Field(0, ge=0)


# --- Public routes ---

@router.get("/config", response_model=DocsConfigOut)
async def get_docs_config(db: AsyncSession = Depends(get_db)):
    """Public: returns is_public and scheduling window."""
    cfg = await get_or_create_config(db)
    return cfg


@router.get("/live-data")
async def get_live_data(db: AsyncSession = Depends(get_db)):
    """Public: live system metrics for dashboard (exact Decimal for money not needed here, counts only).

    Returns:
      - total_users: count from PostgreSQL users table
      - total_quotes: best-effort count (from in-memory store if DB quotes table not yet migrated)
      - mcp_status: Active/Inactive by probing MCP server
      - timestamp: now
    """
    # total_users via async count
    result = await db.execute(select(func.count(User.id)))
    total_users = result.scalar() or 0

    # total_quotes — try DB if quotes table exists, else fallback to 0
    # For now, quotes are still in store.py (in-memory/SQLite), not yet in Postgres.
    # We report 0 and note that future migration will count from DB.
    # To avoid breaking, we try to import store and count.
    total_quotes = 0
    try:
        from app.services import store as store_svc

        # store has _QUOTES_MEMORY dict
        total_quotes = len(getattr(store_svc, "_QUOTES_MEMORY", {}))
        # Also try to count from DB if a quotes table exists (not yet)
        # If we had a Quote model, we'd do: await db.execute(select(func.count(Quote.id)))
    except Exception:
        total_quotes = 0

    # MCP status — probe via GET {MCP_SERVER_URL}/health (httpx, 1s timeout)
    # Fix: Use MCP_SERVER_URL env var (Docker: http://mcp-server:8001, local: http://localhost:8001)
    # and hit the dedicated /health route (not /mcp POST) for a reliable 200 OK.
    import os

    mcp_status = "Inactive (Offline)"
    mcp_base = os.environ.get("MCP_SERVER_URL", "http://localhost:8001")
    # Ensure no trailing slash, then append /health
    mcp_health_url = mcp_base.rstrip("/") + "/health"
    # Also try the alternate host for Docker vs local
    mcp_urls = [mcp_health_url]
    # Add fallback for the other network (if mcp_base is localhost, also try mcp-server; vice versa)
    if "localhost" in mcp_base:
        mcp_urls.append(mcp_base.replace("localhost", "mcp-server").rstrip("/") + "/health")
    elif "mcp-server" in mcp_base:
        mcp_urls.append(mcp_base.replace("mcp-server", "localhost").rstrip("/") + "/health")

    try:
        import httpx  # type: ignore

        for url in mcp_urls:
            try:
                async with httpx.AsyncClient(timeout=1.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        # Verify JSON is {"status":"ok"} if possible, but any 200 with ok is Active
                        try:
                            data = resp.json()
                            if data.get("status") == "ok":
                                mcp_status = "Active"
                                break
                        except Exception:
                            # Non-JSON 200 still counts as Active (server is up)
                            mcp_status = "Active"
                            break
                        mcp_status = "Active"
                        break
            except Exception:
                continue
    except ImportError:
        # Fallback to urllib if httpx not installed
        import urllib.request
        import urllib.error

        for url in mcp_urls:
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:  # type: ignore
                    mcp_status = "Active"
                    break
            except urllib.error.HTTPError as e:
                if e.code in (200, 400, 405, 406, 404):
                    # For /health, we expect 200, but other codes still indicate server is listening
                    # For /health specifically, only 200 is truly Active, but we treat 200 as Active
                    if e.code == 200:
                        mcp_status = "Active"
                        break
                continue
            except Exception:
                continue

    return {
        "total_users": total_users,
        "total_quotes": total_quotes,
        "mcp_status": mcp_status,
        "mcp_server": "xpay-financial-intelligence-mcp",
        "transport": "Streamable HTTP",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "read_only": True,
    }


@router.get("/team", response_model=List[TeamMemberOut])
async def list_team(db: AsyncSession = Depends(get_db)):
    """Public: list team members ordered by order_index."""
    result = await db.execute(select(TeamMember).order_by(TeamMember.order_index, TeamMember.id))
    members = result.scalars().all()
    return members


# --- Admin routes ---

@router.put("/config", response_model=DocsConfigOut)
async def update_docs_config(
    payload: DocsConfigIn,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Admin only: toggle is_public and set scheduling window."""
    cfg = await get_or_create_config(db)
    cfg.is_public = payload.is_public
    cfg.start_time = payload.start_time
    cfg.end_time = payload.end_time
    await db.commit()
    await db.refresh(cfg)
    return cfg


@router.post("/team", response_model=TeamMemberOut, status_code=201)
async def create_team_member(
    payload: TeamMemberIn,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Admin only: add team member."""
    member = TeamMember(
        name=payload.name,
        role=payload.role,
        email=payload.email,
        image_url=payload.image_url,
        order_index=payload.order_index,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/team/{member_id}")
async def delete_team_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Admin only: remove team member."""
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    await db.delete(member)
    await db.commit()
    return {"message": f"Team member {member_id} deleted"}
