"""xPay — Authentication & RBAC (PostgreSQL + async SQLAlchemy 2.0).

Storage: PostgreSQL `users` table via AsyncSession (replaces users.json).
Security: passlib[bcrypt] for hashing, python-jose for JWT.
Roles: admin > user > guest

All database interactions MUST use AsyncSession (AGENT.md rule).
All financial calculations still use exact Decimal before saving — DB is storage only.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User

# --- Config ---
SECRET_KEY = os.environ.get("XPAY_JWT_SECRET", "CHANGE_ME_SECRET_KEY_XPAY_DEMO_INSECURE_32CHARS_DO_NOT_USE_IN_PROD")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class UserInDB(BaseModel):
    email: str
    hashed_password: str
    role: str  # admin | user | guest


class UserOut(BaseModel):
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str


# --- Password helpers (sync — passlib is sync, calc is CPU-bound but fast) ---

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- JWT helpers ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# --- DB helpers (async) ---

async def get_user_by_email(email: str, db: AsyncSession) -> Optional[User]:
    """Async query — replaces JSON reader. Uses: await db.execute(select(User).where(User.email == email))"""
    email_lower = email.lower().strip()
    result = await db.execute(select(User).where(User.email == email_lower))
    return result.scalars().first()


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User))
    return list(result.scalars().all())


async def create_user_in_db(email: str, hashed_password: str, role: str, db: AsyncSession) -> User:
    user = User(email=email.lower().strip(), hashed_password=hashed_password, role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user_from_db(email: str, db: AsyncSession) -> bool:
    user = await get_user_by_email(email, db)
    if not user:
        return False
    await db.delete(user)
    await db.commit()
    return True


# --- Dependency injection for RBAC (async) ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    """Validates JWT and returns User model. Raises 401 if invalid. Queries DB via AsyncSession."""
    payload = decode_token(token)
    email: str | None = payload.get("sub")
    role: str | None = payload.get("role")
    if email is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await get_user_by_email(email, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user role is admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user role is user or admin. Guest is NOT allowed."""
    if current_user.role not in ("user", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User or Admin privileges required. Guest role has read-only access.",
        )
    return current_user
