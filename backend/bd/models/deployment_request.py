import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class DeploymentType(str, enum.Enum):
    STANDARD = "STANDARD"
    ROLLBACK = "ROLLBACK"
    REDEPLOY = "REDEPLOY"


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


_deployment_type_enum = SAEnum(DeploymentType, name="deployment_type", create_type=True)
_request_status_enum = SAEnum(RequestStatus, name="request_status", create_type=True)


class DeploymentRequest(Base):
    __tablename__ = "deployment_requests"
    __table_args__ = (
        CheckConstraint(
            "status != 'REJECTED' OR justification IS NOT NULL",
            name="justification_required_on_rejection",
        ),
        Index("ix_deployment_requests_application_environment_id", "application_environment_id"),
        Index("ix_deployment_requests_requested_by", "requested_by"),
        Index("ix_deployment_requests_approved_by", "approved_by"),
        Index("ix_deployment_requests_status", "status"),
        Index(
            "uq_deployment_requests_in_flight",
            "application_environment_id",
            unique=True,
            postgresql_where=text("status IN ('PENDING', 'APPROVED', 'RUNNING')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("application_environments.id", ondelete="CASCADE"),
    )
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Commit SHA requested at the time of the request (what the user asked to deploy).
    source_commit_sha: Mapped[str | None] = mapped_column(String(40))
    deployment_type: Mapped[DeploymentType] = mapped_column(_deployment_type_enum)
    github_workflow_run_id: Mapped[int | None] = mapped_column(BigInteger())
    status: Mapped[RequestStatus] = mapped_column(
        _request_status_enum, server_default=text("'PENDING'")
    )
    justification: Mapped[str | None] = mapped_column(Text)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
