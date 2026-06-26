import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class DeploymentEventType(str, enum.Enum):
    WORKFLOW_STARTED = "WORKFLOW_STARTED"
    BUILD_COMPLETED = "BUILD_COMPLETED"
    IMAGE_BUILD_FAILED = "IMAGE_BUILD_FAILED"
    IMAGE_PUSHED = "IMAGE_PUSHED"
    GITOPS_UPDATED = "GITOPS_UPDATED"
    SYNC_STARTED = "SYNC_STARTED"
    SYNC_COMPLETED = "SYNC_COMPLETED"
    SYNC_FAILED = "SYNC_FAILED"
    ROLLOUT_STARTED = "ROLLOUT_STARTED"
    ROLLOUT_COMPLETED = "ROLLOUT_COMPLETED"
    POD_CREATED = "POD_CREATED"
    READINESS_PASSED = "READINESS_PASSED"
    READINESS_FAILED = "READINESS_FAILED"
    CRASH_LOOP_BACKOFF = "CRASH_LOOP_BACKOFF"


class Severity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class EventSource(str, enum.Enum):
    KUBERNETES = "KUBERNETES"
    ARGOCD = "ARGOCD"
    GITHUB = "GITHUB"


_deployment_event_type_enum = SAEnum(DeploymentEventType, name="deployment_event_type", create_type=True)
_severity_enum = SAEnum(Severity, name="severity", create_type=True)
_event_source_enum = SAEnum(EventSource, name="event_source", create_type=True)


class DeploymentEvent(Base):
    __tablename__ = "deployment_events"
    __table_args__ = (
        Index("ix_deployment_events_deployment_version_id", "deployment_version_id"),
        Index("ix_deployment_events_event_timestamp", "event_timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deployment_versions.id", ondelete="CASCADE"),
    )
    event_type: Mapped[DeploymentEventType] = mapped_column(_deployment_event_type_enum)
    source: Mapped[EventSource] = mapped_column(_event_source_enum)
    message: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[Severity] = mapped_column(_severity_enum)
    raw_payload: Mapped[str | None] = mapped_column(Text)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
