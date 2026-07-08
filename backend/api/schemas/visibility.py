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
    argocd_application_name: Optional[str] = None
    deployment_order: int
    requires_approval: bool
    approval_required_role: Optional[str] = None
    application_names: list[str] = []
    model_config = {"from_attributes": True}


class ApplicationListItem(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    source_repository: str
    ci_workflow_file: str
    model_config = {"from_attributes": True}


class ProjectSummary(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    git_ops_repository_url: Optional[str] = None
    team_name: str


class ApplicationEnvironmentStatus(BaseModel):
    id: uuid.UUID
    environment_name: str
    lifecycle_status: Optional[LifecycleStatus] = None
    # Set only when there's no DeploymentVersion yet (nothing deployed via DevShip) — a
    # live K8s read of whatever's already running in the namespace, so a freshly onboarded
    # cluster with real workloads doesn't show "Unknown" for pods that are actually healthy.
    discovered_status: Optional[LifecycleStatus] = None


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
    deployment_request_id: Optional[uuid.UUID] = None
    image_tag: Optional[str] = None
    image_digest: Optional[str] = None
    source_commit_sha: Optional[str] = None
    argocd_sync_revision: Optional[str] = None
    kubernetes_deployment_revision: Optional[str] = None
    lifecycle_status: LifecycleStatus
    trigger_source: TriggerSource
    deployed_at: Optional[datetime] = None
    created_at: datetime
    requested_by_email: Optional[str] = None
    model_config = {"from_attributes": True}


class ApplicationEnvironmentDetail(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    environment_id: uuid.UUID
    deployment_name: str
    enabled: bool
    current_version: Optional[DeploymentVersionDetail] = None
    discovered_status: Optional[LifecycleStatus] = None
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
    source_head_sha: Optional[str] = None
    argocd_sync_revision: Optional[str] = None
    reason: Optional[str] = None


class PendingCommit(BaseModel):
    sha: str
    type: Optional[str] = None  # conventional-commit prefix (feat/fix/chore/...), best-effort
    message: str
    author: str
    date: str


class PendingCommitsResponse(BaseModel):
    current_sha: Optional[str] = None
    head_sha: Optional[str] = None
    commits: list[PendingCommit] = []
    reason: Optional[str] = None  # set when commits could not be resolved (never a fake empty list)


class ProbeSpec(BaseModel):
    path: Optional[str] = None
    port: Optional[int] = None
    initial_delay_seconds: int
    period_seconds: int
    timeout_seconds: int
    success_threshold: int
    failure_threshold: int


class ContainerProbeStatus(BaseModel):
    """
    What the Kubernetes API actually exposes per container: probe config (from the pod
    spec) plus current readiness/state (running/waiting/terminated) — not a history of
    individual startup/readiness/liveness pass/fail results, which the API does not report.
    """
    pod_name: str
    container_name: str
    ready: bool
    restart_count: int
    state: str  # "Running" | "Waiting" | "Terminated"
    reason: Optional[str] = None
    message: Optional[str] = None
    error_at: Optional[str] = None
    ready_transition_at: Optional[str] = None
    startup_probe: Optional[ProbeSpec] = None
    readiness_probe: Optional[ProbeSpec] = None
    liveness_probe: Optional[ProbeSpec] = None


class HealthProbesResponse(BaseModel):
    containers: list[ContainerProbeStatus]
