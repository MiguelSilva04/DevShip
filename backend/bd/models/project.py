import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime
import sqlalchemy as sa

from backend.bd.base import Base


class SetupStatus(str, enum.Enum):
    PENDING_CLUSTER = "PENDING_CLUSTER"
    PENDING_ENVIRONMENTS = "PENDING_ENVIRONMENTS"
    PENDING_APPLICATIONS = "PENDING_APPLICATIONS"
    CONFIGURED = "CONFIGURED"


_setup_status_enum = SAEnum(
    SetupStatus,
    name="setup_status",
    create_type=True,
)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_team_id", "team_id"),
        Index("ix_projects_created_by", "created_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean(), server_default=sa.false())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    git_ops_repository_url: Mapped[str | None] = mapped_column(String(512))
    setup_status: Mapped[SetupStatus] = mapped_column(
        _setup_status_enum, server_default=text("'PENDING_CLUSTER'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
