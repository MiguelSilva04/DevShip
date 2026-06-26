import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from backend.bd.base import Base


class ValidationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VALID = "VALID"
    INVALID = "INVALID"


_validation_status_enum = SAEnum(
    ValidationStatus,
    name="validation_status",
    create_type=True,
)


class EnvironmentValidation(Base):
    __tablename__ = "environment_validations"
    __table_args__ = (UniqueConstraint("environment_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
    )
    namespace_status: Mapped[ValidationStatus] = mapped_column(
        _validation_status_enum, server_default=text("'PENDING'")
    )
    namespace_error: Mapped[str | None] = mapped_column(Text)
    branch_status: Mapped[ValidationStatus] = mapped_column(
        _validation_status_enum, server_default=text("'PENDING'")
    )
    branch_error: Mapped[str | None] = mapped_column(Text)
    git_ops_path_status: Mapped[ValidationStatus] = mapped_column(
        _validation_status_enum, server_default=text("'PENDING'")
    )
    git_ops_path_error: Mapped[str | None] = mapped_column(Text)
    overall_status: Mapped[ValidationStatus] = mapped_column(
        _validation_status_enum, server_default=text("'PENDING'")
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
