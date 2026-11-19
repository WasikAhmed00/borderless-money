#!/usr/bin/env python3
"""
Generate backend/data/users.json with hashed demo credentials.

Demo accounts:
  admin@xpay.com / AdminPass123! (admin)
  user@xpay.com  / UserPass123!  (user)
  guest@xpay.com / GuestPass123! (guest)

Usage:
  python backend/generate_hashes.py
  # or
  python3 backend/generate_hashes.py
"""
import json
from pathlib import Path

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERS_FILE = Path(__file__).resolve().parent / "data" / "users.json"

DEMO_USERS = [
    {"email": "admin@xpay.com", "password": "AdminPass123!", "role": "admin"},
    {"email": "user@xpay.com", "password": "UserPass123!", "role": "user"},
    {"email": "guest@xpay.com", "password": "GuestPass123!", "role": "guest"},
]

def main():
    users = []
    for u in DEMO_USERS:
        hashed = pwd_context.hash(u["password"])
        # verify round-trip
        assert pwd_context.verify(u["password"], hashed), f"Hash verify failed for {u['email']}"
        users.append({
            "email": u["email"],
            "hashed_password": hashed,
            "role": u["role"],
        })
        print(f"Hashed {u['email']} ({u['role']}) -> {hashed[:20]}...")

    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)
    print(f"\nWrote {len(users)} users to {USERS_FILE}")
    print("Preview (without hashes):")
    for u in users:
        print(f"  - {u['email']} / role={u['role']}")

if __name__ == "__main__":
    main()
