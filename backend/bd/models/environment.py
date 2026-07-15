import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base
from backend.bd.models.team_member import TeamMemberRole

# create_type=False: the team_member_role PostgreSQL type is owned by the
# team_members migration and must not be created or dropped here.
_approval_role_enum = SAEnum(
    TeamMemberRole,
    name="team_member_role",
    create_type=False,
)


class Environment(Base):
    __tablename__ = "environments"
    __table_args__ = (
        Index("ix_environments_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(String(64))
    display_name: Mapped[str | None] = mapped_column(String(255))
    namespace: Mapped[str | None] = mapped_column(String(255))
    git_ops_base_path: Mapped[str | None] = mapped_column(String(512))
    source_branch: Mapped[str | None] = mapped_column(String(255))
    gitops_branch: Mapped[str | None] = mapped_column(String(255))
    # One ArgoCD Application per Environment — confirmed against the real ArgoCD instance:
    # "demo-app-dev"/"demo-app-staging"/"demo-app-prod" each sync the whole apps/demo-app/{env}
    # path (every Application in that environment together), not one per Application.
    argocd_application_name: Mapped[str | None] = mapped_column(String(255))
    requires_approval: Mapped[bool] = mapped_column(Boolean(), server_default="false")
    approval_required_role: Mapped[TeamMemberRole | None] = mapped_column(_approval_role_enum)
    deployment_order: Mapped[int] = mapped_column(Integer())
    is_archived: Mapped[bool] = mapped_column(Boolean(), server_default=sa.false())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
