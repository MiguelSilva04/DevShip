import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


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
    enabled: Mapped[bool] = mapped_column(Boolean(), server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
