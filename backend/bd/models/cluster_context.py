import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class ClusterContext(Base):
    __tablename__ = "cluster_contexts"
    __table_args__ = (
        UniqueConstraint("project_id"),
        UniqueConstraint("external_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )
    cluster_arn: Mapped[str] = mapped_column(String(512))
    cluster_name: Mapped[str] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(64))
    eks_endpoint: Mapped[str] = mapped_column(String(512))
    ca_certificate: Mapped[str] = mapped_column(Text)
    ca_file_path: Mapped[str] = mapped_column(Text)
    iam_role_arn: Mapped[str] = mapped_column(String(512))
    external_id: Mapped[str] = mapped_column(String(128))
    # Namespace where ArgoCD Application CRs live in this cluster — not a fixed convention
    # across clusters, so it must be configurable rather than assumed as "argocd".
    argocd_namespace: Mapped[str] = mapped_column(String(255), server_default=text("'argocd'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Set on every successful validate_cluster call (initial configure_cluster and every
    # revalidate_cluster) — distinct from created_at, which only ever reflects row creation.
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
