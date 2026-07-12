import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class TeamMemberRole(str, enum.Enum):
    DEVELOPER = "DEVELOPER"
    TECH_LEAD = "TECH_LEAD"
    CLOUD_ENGINEER = "CLOUD_ENGINEER"


class TeamMemberStatus(str, enum.Enum):
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


_role_enum = SAEnum(
    TeamMemberRole,
    name="team_member_role",
    create_type=True,
)

_status_enum = SAEnum(
    TeamMemberStatus,
    name="team_member_status",
    create_type=True,
)


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id"),
        Index("ix_team_members_team_id", "team_id"),
        Index("ix_team_members_user_id", "user_id"),
        Index("ix_team_members_added_by", "added_by"),
        Index("ix_team_members_confirmed_by", "confirmed_by"),
        Index("ix_team_members_rejected_by", "rejected_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    role: Mapped[TeamMemberRole] = mapped_column(_role_enum)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    added_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    # PENDING_CONFIRMATION only for the CE founder of a 2nd+ Team in an existing Company
    # (create_team overrides the default explicitly) — every other member (invited via
    # add_team_member, or the bootstrap CE of a brand-new Company) is born CONFIRMED.
    status: Mapped[TeamMemberStatus] = mapped_column(
        _status_enum, server_default=text("'CONFIRMED'")
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
