import enum
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from backend.bd.models.deployment_version import LifecycleStatus, TriggerSource


class UpToDateStatus(str, enum.Enum):
    UP_TO_DATE = "UpToDate"
    OUTDATED = "Outdated"
    UNKNOWN = "Unknown"


class EnvironmentListItem(BaseModel):
    id: uuid.UUID
    name: str
    display_name: Optional[str] = None
    namespace: Optional[str] = None
    git_ops_base_path: Optional[str] = None
    source_branch: Optional[str] = None
    gitops_branch: Optional[str] = None
    deployment_order: int
    requires_approval: bool
    approval_required_role: Optional[str] = None
    model_config = {"from_attributes": True}


class ApplicationListItem(BaseModel):
    id: uuid.UUID
    name: str
    source_repository: str
    model_config = {"from_attributes": True}


class ApplicationEnvironmentStatus(BaseModel):
    id: uuid.UUID
    environment_name: str
    lifecycle_status: Optional[LifecycleStatus] = None


class ApplicationDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    source_repository: str
    description: Optional[str] = None
    environments: list[ApplicationEnvironmentStatus]
    model_config = {"from_attributes": True}


class ApplicationWithStatus(BaseModel):
    id: uuid.UUID
    name: str
    environments: list[ApplicationEnvironmentStatus]


class HomepageResponse(BaseModel):
    total_application_environments: int
    healthy_count: int
    degraded_count: int
    deploys_today: int
    applications: list[ApplicationWithStatus]


class DeploymentVersionDetail(BaseModel):
    id: uuid.UUID
    image_tag: Optional[str] = None
    image_digest: Optional[str] = None
    version_label: Optional[str] = None
    source_commit_sha: Optional[str] = None
    argocd_sync_revision: Optional[str] = None
    kubernetes_deployment_revision: Optional[str] = None
    lifecycle_status: LifecycleStatus
    trigger_source: TriggerSource
    deployed_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ApplicationEnvironmentDetail(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    environment_id: uuid.UUID
    deployment_name: str
    enabled: bool
    current_version: Optional[DeploymentVersionDetail] = None
    model_config = {"from_attributes": True}


class PodStatus(BaseModel):
    name: str
    phase: str
    ready: str
    restart_count: int
    node_name: Optional[str] = None
    creation_timestamp: Optional[str] = None
    cpu: Optional[str] = None
    memory: Optional[str] = None


class PodListResponse(BaseModel):
    pods: list[PodStatus]
    metrics_available: bool


class K8sEvent(BaseModel):
    type: str
    reason: str
    object_ref: str
    message: str
    last_timestamp: Optional[str] = None


class LogLine(BaseModel):
    timestamp: Optional[str] = None
    level: Optional[str] = None
    message: str


class LogsResponse(BaseModel):
    pod_name: str
    lines: list[LogLine]


class UpToDateResponse(BaseModel):
    status: UpToDateStatus
    gitops_head_sha: Optional[str] = None
    argocd_sync_revision: Optional[str] = None
    reason: Optional[str] = None
