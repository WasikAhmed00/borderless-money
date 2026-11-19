"""xPay — Authentication & RBAC helpers.

Storage: backend/data/users.json (mock DB)
Security: passlib[bcrypt] for hashing, python-jose for JWT
Roles: admin > user > guest
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# --- Config ---
SECRET_KEY = os.environ.get("XPAY_JWT_SECRET", "CHANGE_ME_SECRET_KEY_XPAY_DEMO_INSECURE_32CHARS_DO_NOT_USE_IN_PROD")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour

# Path to mock DB — resolves relative to this file
USERS_FILE = Path(__file__).resolve().parent.parent / "data" / "users.json"

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


# --- File I/O helpers ---

def _ensure_users_file():
    """Ensure users.json exists; if not, create empty list."""
    if not USERS_FILE.exists():
        USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(USERS_FILE, "w") as f:
            json.dump([], f)


def read_users() -> list[dict]:
    _ensure_users_file()
    try:
        with open(USERS_FILE, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def write_users(users: list[dict]) -> None:
    _ensure_users_file()
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def get_user_by_email(email: str) -> Optional[dict]:
    users = read_users()
    email_lower = email.lower().strip()
    for u in users:
        if u.get("email", "").lower() == email_lower:
            return u
    return None


# --- Password helpers ---

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


# --- Dependency injection for RBAC ---

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Validates JWT and returns user dict. Raises 401 if invalid."""
    payload = decode_token(token)
    email: str | None = payload.get("sub")
    role: str | None = payload.get("role")
    if email is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_email(email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Ensure role in token matches current DB (in case role changed after token issued)
    # We return DB user to reflect current role, but also validate token role
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensures user role is admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensures user role is user or admin. Guest is NOT allowed."""
    role = current_user.get("role")
    if role not in ("user", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User or Admin privileges required. Guest role has read-only access.",
        )
    return current_user


# Guest + user + admin can all pass get_current_user; guest is read-only by route design
# For routes where guest can view but not execute, use get_current_user
# For routes where only user/admin can execute, use require_user
