import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class LifecycleStatus(str, enum.Enum):
    DEPLOYING = "Deploying"
    HEALTHY = "Healthy"
    DEGRADED = "Degraded"
    FAILED = "Failed"
    ROLLED_BACK = "RolledBack"
    SUPERSEDED = "Superseded"


class TriggerSource(str, enum.Enum):
    DEVSHIP = "DEVSHIP"
    EXTERNAL = "EXTERNAL"


_lifecycle_status_enum = SAEnum(
    LifecycleStatus,
    name="lifecycle_status",
    create_type=True,
    values_callable=lambda x: [e.value for e in x],
)
_trigger_source_enum = SAEnum(TriggerSource, name="trigger_source", create_type=True)


class DeploymentVersion(Base):
    __tablename__ = "deployment_versions"
    __table_args__ = (
        UniqueConstraint("deployment_request_id"),
        Index("ix_deployment_versions_application_environment_id", "application_environment_id"),
        Index("ix_deployment_versions_lifecycle_status", "lifecycle_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("application_environments.id", ondelete="CASCADE"),
    )
    deployment_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deployment_requests.id", ondelete="SET NULL"),
    )
    image_tag: Mapped[str | None] = mapped_column(String(255))
    # The commit that was actually versioned — may differ from source_commit_sha
    # in the originating deployment_request if the build resolved a different ref.
    source_commit_sha: Mapped[str | None] = mapped_column(String(40))
    argocd_sync_revision: Mapped[str | None] = mapped_column(String(64))
    lifecycle_status: Mapped[LifecycleStatus] = mapped_column(
        _lifecycle_status_enum, server_default=text("'Deploying'")
    )
    trigger_source: Mapped[TriggerSource] = mapped_column(
        _trigger_source_enum, server_default=text("'DEVSHIP'")
    )
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set whenever a live cluster read (manual refresh) determines lifecycle_status.
    # Lets read-time recompute-from-events know not to overwrite a live result with a
    # stale one derived from events older than the last live check.
    health_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
