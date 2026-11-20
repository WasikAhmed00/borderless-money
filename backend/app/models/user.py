"""User model — async SQLAlchemy 2.0 Mapped syntax.

Replaces backend/data/users.json. Stores auth users (admin/user/guest) with
bcrypt-hashed passwords. All financial calculations still use exact Decimal
(Python) before saving — DB is storage only.
"""

import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # admin | user | guest
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
