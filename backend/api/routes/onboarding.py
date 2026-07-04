import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.api.schemas.onboarding import (
    AddMemberRequest,
    ApplicationEnvironmentImport,
    ApplicationImportRequest,
    ApplicationResponse,
    CandidateEntry,
    ClusterConfigRequest,
    ClusterContextResponse,
    ClusterSetupInfo,
    EnvironmentCreate,
    EnvironmentResponse,
    EnvironmentValidationResult,
    GitOpsScanResult,
    MemberEntry,
    ProjectCreate,
    ProjectResponse,
    TeamCreate,
    TeamMembersResponse,
    TeamResponse,
    UserTeamEntry,
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.environment import Environment
from backend.bd.models.environment_validation import EnvironmentValidation, ValidationStatus
from backend.bd.models.project import Project, SetupStatus
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User
from backend.services import cluster_validation as cv
from backend.services import gitops_scanner as gs
from backend.services.gitops_scanner import path_exists, validate_branch
from backend.services.kubernetes_reader import list_namespaces

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_cloud_engineer_of_team(db: Session, team_id: uuid.UUID, user: User) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user.id)
        .first()
    )
    if member is None or member.role != TeamMemberRole.CLOUD_ENGINEER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="É necessário ter o papel de Cloud Engineer para executar esta ação.")
    return team


def _require_cloud_engineer(db: Session, project_id: uuid.UUID, user: User) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _require_cloud_engineer_of_team(db, project.team_id, user)
    return project


# ---------------------------------------------------------------------------
# Current user's teams (Lobby)
# ---------------------------------------------------------------------------

@router.get("/users/me/domain-status")
def my_domain_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns whether the current user's email domain already has a Team."""
    domain = current_user.email.rsplit("@", 1)[-1]
    team = db.query(Team).filter(Team.domain == domain).first()
    return {"domain": domain, "has_team": team is not None, "team_id": str(team.id) if team else None}


@router.get("/users/me/teams", response_model=list[UserTeamEntry])
def list_my_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TeamMember, Team, Project)
        .join(Team, TeamMember.team_id == Team.id)
        .outerjoin(Project, Project.team_id == Team.id)
        .filter(TeamMember.user_id == current_user.id)
        .all()
    )
    return [
        UserTeamEntry(
            user_name=current_user.name,
            user_email=current_user.email,
            team_id=team.id,
            team_name=team.name,
            role=member.role,
            project_id=project.id if project else None,
            project_name=project.name if project else None,
            setup_status=project.setup_status if project else None,
        )
        for member, team, project in rows
    ]


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------

@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(body: TeamCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    domain = current_user.email.rsplit("@", 1)[-1]
    if db.query(Team).filter(Team.domain == domain).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma equipa para este domínio. Pede ao Cloud Engineer que te adicione.",
        )
    team_id = uuid.uuid4()
    team = Team(id=team_id, name=body.name, description=body.description, domain=domain)
    member = TeamMember(team_id=team_id, user_id=current_user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None)
    db.add(team)
    db.add(member)
    db.commit()
    db.refresh(team)
    return team


# ---------------------------------------------------------------------------
# Team members — list (existing + pending candidates) + add
# ---------------------------------------------------------------------------

@router.get("/teams/{team_id}/members")
def list_team_members(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _require_cloud_engineer_of_team(db, team_id, current_user)

    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()

    member_entries = []
    for m in members:
        u = db.get(User, m.user_id)
        member_entries.append(MemberEntry(user_id=m.user_id, name=u.name, email=u.email, role=m.role))

    # Users sharing the domain with no TeamMember anywhere
    candidates_q = (
        db.query(User)
        .outerjoin(TeamMember, TeamMember.user_id == User.id)
        .filter(
            User.email.ilike(f"%@{team.domain}"),
            TeamMember.id.is_(None),
        )
        .all()
    )
    candidate_entries = [CandidateEntry(user_id=u.id, name=u.name, email=u.email) for u in candidates_q]

    return TeamMembersResponse(members=member_entries, candidates=candidate_entries)


@router.post("/teams/{team_id}/members", status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: uuid.UUID,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_cloud_engineer_of_team(db, team_id, current_user)

    target = db.get(User, body.user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    member = TeamMember(
        team_id=team_id,
        user_id=body.user_id,
        role=body.role,
        added_by=current_user.id,
    )
    db.add(member)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this team")
    db.commit()

    return MemberEntry(user_id=target.id, name=target.name, email=target.email, role=body.role)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.post("/teams/{team_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    team_id: uuid.UUID,
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
        .first()
    )
    if member is None or member.role != TeamMemberRole.CLOUD_ENGINEER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="É necessário ter o papel de Cloud Engineer para executar esta ação.")

    existing = db.query(Project).filter(Project.team_id == team_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta equipa já tem um projeto criado.")

    project = Project(
        team_id=team_id,
        created_by=current_user.id,
        name=body.name,
        description=body.description,
        git_ops_repository_url=body.git_ops_repository_url,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# Cluster setup info (GET — no write)
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/cluster-setup-info", response_model=ClusterSetupInfo)
def cluster_setup_info(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    project = _require_cloud_engineer(db, project_id, current_user)
    external_id = f"ext-{project.id}"
    devship_account_id = os.environ["DEVSHIP_AWS_ACCOUNT_ID"]
    return ClusterSetupInfo(
        devship_account_id=devship_account_id,
        external_id=external_id,
        trust_policy={
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": f"arn:aws:iam::{devship_account_id}:root"},
                    "Action": "sts:AssumeRole",
                    "Condition": {"StringEquals": {"sts:ExternalId": external_id}},
                }
            ],
        },
        permission_policy={
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "eks:DescribeCluster",
                    ],
                    "Resource": "*",
                }
            ],
        },
        access_entry_commands=[
            "aws eks create-access-entry --cluster-name CLUSTER_NAME --principal-arn ROLE_ARN --region REGION",
            "aws eks associate-access-policy --cluster-name CLUSTER_NAME --principal-arn ROLE_ARN "
            "--policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy "
            "--access-scope type=cluster --region REGION",
        ],
    )


# ---------------------------------------------------------------------------
# Cluster validation + persist
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/cluster", response_model=ClusterContextResponse)
def get_cluster(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_cloud_engineer(db, project_id, current_user)
    cluster = db.query(ClusterContext).filter(ClusterContext.project_id == project_id).first()
    if not cluster:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster ainda não configurado.")
    return cluster


@router.post("/projects/{project_id}/cluster", response_model=ClusterContextResponse, status_code=status.HTTP_201_CREATED)
def configure_cluster(
    project_id: uuid.UUID,
    body: ClusterConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)

    if db.query(ClusterContext).filter(ClusterContext.project_id == project_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="O cluster já está configurado para este projeto.")

    external_id = f"ext-{project.id}"

    try:
        info = cv.validate_cluster(body.cluster_arn, body.iam_role_arn, external_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    cluster = ClusterContext(
        project_id=project_id,
        cluster_arn=body.cluster_arn,
        cluster_name=info.name,
        region=info.region,
        eks_endpoint=info.endpoint,
        ca_certificate=info.ca_certificate,
        ca_file_path=info.ca_file_path,
        iam_role_arn=body.iam_role_arn,
        external_id=external_id,
    )
    db.add(cluster)
    project.setup_status = SetupStatus.PENDING_ENVIRONMENTS
    db.commit()
    db.refresh(cluster)
    return cluster


# ---------------------------------------------------------------------------
# Environments
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/environments", response_model=list[EnvironmentResponse], status_code=status.HTTP_201_CREATED)
def create_environments(
    project_id: uuid.UUID,
    body: list[EnvironmentCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)

    cluster = db.query(ClusterContext).filter(ClusterContext.project_id == project_id).first()
    git_ops_url = project.git_ops_repository_url

    results = []
    for env_data in body:
        # Upsert by (project_id, name) — idempotent on re-submit
        env = db.query(Environment).filter(
            Environment.project_id == project_id,
            Environment.name == env_data.name,
        ).first()
        if env is None:
            env = Environment(project_id=project_id, name=env_data.name)
            db.add(env)

        env.display_name = env_data.display_name
        env.namespace = env_data.namespace
        env.git_ops_base_path = env_data.git_ops_base_path
        env.source_branch = env_data.source_branch
        env.gitops_branch = env_data.gitops_branch
        env.argocd_application_name = env_data.argocd_application_name
        env.requires_approval = env_data.requires_approval
        env.approval_required_role = env_data.approval_required_role
        env.deployment_order = env_data.deployment_order
        db.flush()

        validation = db.query(EnvironmentValidation).filter(EnvironmentValidation.environment_id == env.id).first()
        if validation is None:
            validation = EnvironmentValidation(environment_id=env.id)
            db.add(validation)
        _run_environment_validations(validation, env, cluster, git_ops_url)
        db.flush()

        results.append(_env_response(env, validation))

    project.setup_status = SetupStatus.PENDING_APPLICATIONS
    db.commit()
    return results


def _run_environment_validations(
    v: EnvironmentValidation,
    env: Environment,
    cluster: ClusterContext | None,
    git_ops_url: str | None,
) -> None:
    # 1. Namespace check via K8s
    if cluster and env.namespace:
        try:
            # ponytail: full re-auth per validation call is fine for onboarding frequency, DEV-10 revisit
            eks_info = _get_cluster_token(cluster)
            namespaces = list_namespaces(eks_info)
            if env.namespace in [ns.metadata.name for ns in namespaces.items]:
                v.namespace_status = ValidationStatus.VALID
            else:
                v.namespace_status = ValidationStatus.INVALID
                v.namespace_error = f"Namespace '{env.namespace}' not found in cluster"
        except Exception as e:
            v.namespace_status = ValidationStatus.INVALID
            v.namespace_error = str(e)
    else:
        v.namespace_status = ValidationStatus.VALID  # skipped — no cluster yet or no namespace set

    # 2. Branch check via GitHub — gitops_branch, this validates the GitOps repo, not the app repo
    if git_ops_url and env.gitops_branch:
        try:
            ok = validate_branch(git_ops_url, env.gitops_branch)
            v.branch_status = ValidationStatus.VALID if ok else ValidationStatus.INVALID
            if not ok:
                v.branch_error = f"Branch '{env.gitops_branch}' not found in {git_ops_url}"
        except Exception as e:
            v.branch_status = ValidationStatus.INVALID
            v.branch_error = str(e)
    else:
        v.branch_status = ValidationStatus.VALID

    # 3. GitOps path check via GitHub
    if git_ops_url and env.git_ops_base_path and env.gitops_branch:
        try:
            ok = path_exists(git_ops_url, env.git_ops_base_path, env.gitops_branch)
            v.git_ops_path_status = ValidationStatus.VALID if ok else ValidationStatus.INVALID
            if not ok:
                v.git_ops_path_error = f"Path '{env.git_ops_base_path}' not found on branch '{env.gitops_branch}'"
        except Exception as e:
            v.git_ops_path_status = ValidationStatus.INVALID
            v.git_ops_path_error = str(e)
    else:
        v.git_ops_path_status = ValidationStatus.VALID

    all_valid = all(
        s == ValidationStatus.VALID
        for s in (v.namespace_status, v.branch_status, v.git_ops_path_status)
    )
    v.overall_status = ValidationStatus.VALID if all_valid else ValidationStatus.INVALID

    from datetime import datetime, timezone
    v.validated_at = datetime.now(timezone.utc)


def _get_cluster_token(cluster: ClusterContext):
    """Re-authenticate and return a fresh EKSClusterInfo for an already-configured cluster."""
    return cv.get_cluster_token(
        iam_role_arn=cluster.iam_role_arn,
        external_id=cluster.external_id,
        cluster_arn=cluster.cluster_arn,
    )


def _env_response(env: Environment, validation: EnvironmentValidation) -> EnvironmentResponse:
    return EnvironmentResponse(
        id=env.id,
        name=env.name,
        deployment_order=env.deployment_order,
        validation=EnvironmentValidationResult.model_validate(validation),
    )


# ---------------------------------------------------------------------------
# GitOps scan
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/gitops-scan", response_model=list[GitOpsScanResult])
def gitops_scan(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)

    if not project.git_ops_repository_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Project has no git_ops_repository_url — set it when creating the project",
        )

    environments = db.query(Environment).filter(Environment.project_id == project_id).all()
    env_paths = [(e.name, e.git_ops_base_path) for e in environments if e.git_ops_base_path]

    try:
        candidates = gs.scan_gitops_repo(project.git_ops_repository_url, env_paths)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    return [GitOpsScanResult(**c) for c in candidates]


# ---------------------------------------------------------------------------
# Application import
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/applications/import", response_model=list[ApplicationResponse], status_code=status.HTTP_201_CREATED)
def import_applications(
    project_id: uuid.UUID,
    body: ApplicationImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)

    created = []
    for item in body.applications:
        app = Application(
            project_id=project_id,
            name=item.name,
            source_repository=item.source_repository,
            container_registry_repository=item.container_registry_repository,
            ci_workflow_file=item.ci_workflow_file,
            created_by=current_user.id,
        )
        db.add(app)
        try:
            with db.begin_nested():
                db.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"source_repository '{item.source_repository}' already belongs to another project",
            )

        for ae in item.environments:
            db.add(ApplicationEnvironment(
                application_id=app.id,
                environment_id=ae.environment_id,
                deployment_name=ae.deployment_name,
                manifest_path=ae.manifest_path,
            ))

        created.append(app)

    project.setup_status = SetupStatus.CONFIGURED
    db.commit()
    return created
