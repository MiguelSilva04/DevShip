import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from backend.bd.models.environment_validation import ValidationStatus
from backend.bd.models.project import SetupStatus
from backend.bd.models.team_member import TeamMemberRole, TeamMemberStatus


# --- Team ---

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    domain: str
    # Only populated by create_team, so the frontend knows whether the CE it just
    # created needs to wait for cross-Team confirmation before continuing onboarding.
    member_status: Optional[TeamMemberStatus] = None

    model_config = {"from_attributes": True}


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberEntry(BaseModel):
    team_member_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    role: TeamMemberRole
    joined_at: datetime
    application_ids: list[uuid.UUID] = []


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
    application_ids: list[uuid.UUID] = []


class PatchMemberRequest(BaseModel):
    role: Optional[TeamMemberRole] = None
    application_ids: Optional[list[uuid.UUID]] = None


# --- Project ---

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    git_ops_repository_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    setup_status: SetupStatus
    git_ops_repository_url: Optional[str] = None
    is_archived: bool

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


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
    argocd_namespace: Optional[str] = None


class RbacCheckResponse(BaseModel):
    rbac_subject: Optional[str] = None
    argocd_ok: bool
    argocd_error: Optional[str] = None
    metrics_ok: bool
    metrics_error: Optional[str] = None


class ClusterContextResponse(BaseModel):
    id: uuid.UUID
    cluster_arn: str
    cluster_name: str
    region: str
    eks_endpoint: str
    external_id: str
    argocd_namespace: str
    created_at: datetime
    last_validated_at: Optional[datetime] = None

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
    argocd_status: ValidationStatus
    argocd_error: Optional[str] = None
    overall_status: ValidationStatus

    model_config = {"from_attributes": True}


class EnvironmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    deployment_order: int
    validation: EnvironmentValidationResult

    model_config = {"from_attributes": True}


class EnvironmentUpdate(BaseModel):
    display_name: Optional[str] = None
    namespace: Optional[str] = None
    git_ops_base_path: Optional[str] = None
    source_branch: Optional[str] = None
    gitops_branch: Optional[str] = None
    argocd_application_name: Optional[str] = None
    requires_approval: Optional[bool] = None
    approval_required_role: Optional[TeamMemberRole] = None
    deployment_order: Optional[int] = None


# --- GitOps scan ---

class GitOpsScanResult(BaseModel):
    name: str
    source_repository: str
    manifest_path: str
    environments: list[str]


# --- User teams (Lobby) ---

class ProjectSummaryEntry(BaseModel):
    id: uuid.UUID
    name: str
    setup_status: SetupStatus


class UserTeamEntry(BaseModel):
    user_name: str
    user_email: str
    team_id: uuid.UUID
    team_name: str
    role: TeamMemberRole
    company_id: uuid.UUID
    company_name: str
    status: TeamMemberStatus
    projects: list[ProjectSummaryEntry] = []


# --- Domain / Company status (Lobby) ---

class DomainStatusResponse(BaseModel):
    domain: str
    # True apenas quando a Company já tem pelo menos uma Team com um Cloud Engineer
    # CONFIRMED — é isso que torna "pedir para seres adicionado" uma opção real. Uma
    # Company sem nenhum CE confirmado (ex.: todas as Teams foram apagadas) deve
    # continuar a permitir bootstrap, como se o domínio fosse novo.
    has_company: bool
    company_id: Optional[uuid.UUID] = None


class PendingTeamEntry(BaseModel):
    team_id: uuid.UUID
    team_name: str
    team_description: Optional[str] = None
    created_at: datetime
    pending_user_id: uuid.UUID
    pending_user_name: str
    pending_user_email: str


# --- Application import ---

class ApplicationEnvironmentImport(BaseModel):
    environment_id: uuid.UUID
    deployment_name: str
    manifest_path: Optional[str] = None


class ApplicationImportItem(BaseModel):
    name: str
    source_repository: str
    ci_workflow_file: str
    environments: list[ApplicationEnvironmentImport]


class ApplicationImportRequest(BaseModel):
    applications: list[ApplicationImportItem]


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    name: str
    source_repository: str

    model_config = {"from_attributes": True}


class ApplicationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_repository: Optional[str] = None
    ci_workflow_file: Optional[str] = None


# --- GitHub identity ---

class GithubIdentityRequest(BaseModel):
    github_username: str
    github_email: str


class GithubIdentityResponse(BaseModel):
    github_username: Optional[str] = None
    github_email: Optional[str] = None
