import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from backend.bd.models.deployment_event import DeploymentEventType, EventSource, Severity
from backend.bd.models.deployment_request import DeploymentType, RequestStatus


class DeployRequest(BaseModel):
    justification: Optional[str] = None  # optional note from requester, NOT the rejection justification
    confirmed: bool = False  # second click after seeing the authorship warning — skips re-emitting it


class RollbackRequest(BaseModel):
    # No deployment_version_id — rollback always targets the last HEALTHY version for the
    # ApplicationEnvironment, server-side. No manual version selection (design doc rule).
    justification: Optional[str] = None


class RejectRequest(BaseModel):
    justification: str  # required — Pydantic gives 422 before the DB CHECK fires


class DeploymentRequestResponse(BaseModel):
    id: uuid.UUID
    application_environment_id: uuid.UUID
    status: RequestStatus
    deployment_type: DeploymentType
    rollback_target_version_id: Optional[uuid.UUID] = None
    source_commit_sha: Optional[str] = None
    github_workflow_run_id: Optional[int] = None
    justification: Optional[str] = None
    failure_reason: Optional[str] = None
    requested_at: datetime
    requested_by_email: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by_email: Optional[str] = None
    completed_at: Optional[datetime] = None
    warning: Optional[str] = None  # non-blocking, e.g. "commit not authored by you"

    model_config = {"from_attributes": True}


class DeploymentEventResponse(BaseModel):
    id: uuid.UUID
    event_type: DeploymentEventType
    source: EventSource
    severity: Severity
    message: Optional[str] = None
    event_timestamp: datetime

    model_config = {"from_attributes": True}


class DeploymentRequestWithEvents(BaseModel):
    request: DeploymentRequestResponse
    events: list[DeploymentEventResponse]
