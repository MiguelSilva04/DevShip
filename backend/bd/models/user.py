import uuid
from datetime import datetime

from sqlalchemy import Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # Partial unique indexes — NULLs (not-yet-configured identity) don't collide,
        # but two DevShip accounts can never claim the same GitHub identity. A GitHub
        # username/account email is owned by exactly one person; letting two accounts
        # share one would mean one person deploying under someone else's identity.
        Index(
            "ix_users_github_username_unique", "github_username",
            unique=True, postgresql_where=text("github_username IS NOT NULL"),
        ),
        Index(
            "ix_users_github_email_unique", "github_email",
            unique=True, postgresql_where=text("github_email IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    github_username: Mapped[str | None] = mapped_column(String(255))
    github_email: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
