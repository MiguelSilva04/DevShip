import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base
from backend.bd.models.deployment_version import LifecycleStatus

# Reuses the "lifecycle_status" Postgres enum type already created for
# DeploymentVersion.lifecycle_status — create_type=False so this column doesn't try to
# create the type a second time.
_discovered_status_enum = SAEnum(
    LifecycleStatus,
    name="lifecycle_status",
    create_type=False,
    values_callable=lambda x: [e.value for e in x],
)


class ApplicationEnvironment(Base):
    __tablename__ = "application_environments"
    __table_args__ = (
        UniqueConstraint("application_id", "environment_id"),
        Index("ix_application_environments_application_id", "application_id"),
        Index("ix_application_environments_environment_id", "environment_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
    )
    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
    )
    deployment_name: Mapped[str] = mapped_column(String(255))
    service_name: Mapped[str | None] = mapped_column(String(255))
    manifest_path: Mapped[str | None] = mapped_column(String(512))
    replicas: Mapped[int | None] = mapped_column(Integer())
    resource_limits: Mapped[str | None] = mapped_column(Text)
    exposure_type: Mapped[str | None] = mapped_column(String(32))
    deployment_strategy: Mapped[str | None] = mapped_column(String(64))
    health_probe_path: Mapped[str | None] = mapped_column(String(255))
    is_archived: Mapped[bool] = mapped_column(Boolean(), server_default=sa.false())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Cached live-K8s-read result for ApplicationEnvironments with no DeploymentVersion yet
    # (workload imported/managed outside DevShip). See _discover_lifecycle_status() in
    # backend/api/routes/visibility.py — TTL avoids hitting the cluster on every page load.
    discovered_status: Mapped[LifecycleStatus | None] = mapped_column(_discovered_status_enum)
    discovered_status_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
