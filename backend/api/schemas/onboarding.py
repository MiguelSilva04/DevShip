import uuid
from typing import Optional

from pydantic import BaseModel

from backend.bd.models.environment_validation import ValidationStatus
from backend.bd.models.project import SetupStatus
from backend.bd.models.team_member import TeamMemberRole


# --- Team ---

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamResponse(BaseModel):
    id: uuid.UUID
    name: str
    domain: str

    model_config = {"from_attributes": True}


class MemberEntry(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    role: TeamMemberRole


class CandidateEntry(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str


class TeamMembersResponse(BaseModel):
    members: list[MemberEntry]
    candidates: list[CandidateEntry]


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: TeamMemberRole


# --- Project ---

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    git_ops_repository_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    setup_status: SetupStatus
    git_ops_repository_url: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Cluster setup info (GET, no write) ---

class ClusterSetupInfo(BaseModel):
    devship_account_id: str
    external_id: str
    trust_policy: dict
    permission_policy: dict
    access_entry_commands: list[str]


# --- Cluster config (POST) ---

class ClusterConfigRequest(BaseModel):
    cluster_arn: str
    iam_role_arn: str


class ClusterContextResponse(BaseModel):
    id: uuid.UUID
    cluster_name: str
    region: str
    eks_endpoint: str
    external_id: str

    model_config = {"from_attributes": True}


# --- Environments ---

class EnvironmentCreate(BaseModel):
    name: str
    display_name: Optional[str] = None
    namespace: Optional[str] = None
    git_ops_base_path: Optional[str] = None
    source_branch: Optional[str] = None
    gitops_branch: Optional[str] = None
    argocd_application_name: Optional[str] = None
    requires_approval: bool = False
    approval_required_role: Optional[TeamMemberRole] = None
    deployment_order: int


class EnvironmentValidationResult(BaseModel):
    namespace_status: ValidationStatus
    namespace_error: Optional[str] = None
    branch_status: ValidationStatus
    branch_error: Optional[str] = None
    git_ops_path_status: ValidationStatus
    git_ops_path_error: Optional[str] = None
    overall_status: ValidationStatus

    model_config = {"from_attributes": True}


class EnvironmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    deployment_order: int
    validation: EnvironmentValidationResult

    model_config = {"from_attributes": True}


# --- GitOps scan ---

class GitOpsScanResult(BaseModel):
    name: str
    source_repository: str
    manifest_path: str
    environments: list[str]


# --- User teams (Lobby) ---

class UserTeamEntry(BaseModel):
    user_name: str
    user_email: str
    team_id: uuid.UUID
    team_name: str
    role: TeamMemberRole
    project_id: Optional[uuid.UUID] = None
    project_name: Optional[str] = None
    setup_status: Optional[SetupStatus] = None


# --- Application import ---

class ApplicationEnvironmentImport(BaseModel):
    environment_id: uuid.UUID
    deployment_name: str
    manifest_path: Optional[str] = None


class ApplicationImportItem(BaseModel):
    name: str
    source_repository: str
    container_registry_repository: str
    ci_workflow_file: str
    environments: list[ApplicationEnvironmentImport]


class ApplicationImportRequest(BaseModel):
    applications: list[ApplicationImportItem]


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    name: str
    source_repository: str

    model_config = {"from_attributes": True}
