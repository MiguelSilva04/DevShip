import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    ApplicationUpdate,
    EnvironmentCreate,
    EnvironmentResponse,
    EnvironmentUpdate,
    EnvironmentValidationResult,
    GithubIdentityRequest,
    GithubIdentityResponse,
    GitOpsScanResult,
    MemberEntry,
    PatchMemberRequest,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    RbacCheckResponse,
    TeamCreate,
    TeamMembersResponse,
    TeamResponse,
    TeamUpdate,
    UserTeamEntry,
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.environment import Environment
from backend.bd.models.environment_validation import EnvironmentValidation, ValidationStatus
from backend.bd.models.project import Project, SetupStatus
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User
from backend.services import cluster_validation as cv
from backend.services import gitops_scanner as gs
from backend.services.aws_auth import compute_rbac_subject
from backend.services.gitops_scanner import is_repo_collaborator, path_exists, repo_exists, validate_branch
from backend.services.kubernetes_reader import (
    KubernetesNotFoundError,
    check_argocd_access,
    check_metrics_access,
    get_argocd_application,
    list_namespaces,
)

router = APIRouter()
logger = logging.getLogger(__name__)


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


def _require_team_manager(db: Session, team_id: uuid.UUID, user: User) -> tuple[Team, TeamMember]:
    """TECH_LEAD ou CLOUD_ENGINEER da Team. Devolve o TeamMember de quem chama, para os
    endpoints que precisam de saber qual dos dois é (ex.: TECH_LEAD não pode tocar em
    CLOUD_ENGINEER/TECH_LEAD alheio)."""
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user.id)
        .first()
    )
    if member is None or member.role not in (TeamMemberRole.TECH_LEAD, TeamMemberRole.CLOUD_ENGINEER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="É necessário ter o papel de Tech Lead ou Cloud Engineer para executar esta ação.")
    return team, member


def _require_team_reader(db: Session, team_id: uuid.UUID, user: User) -> Team:
    """Any TeamMember (Developer included) can read the Team page — only mutating it
    (add/edit/remove members, edit team identity) requires _require_team_manager."""
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user.id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não pertences a esta equipa.")
    return team


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


@router.patch("/users/me/github-identity", response_model=GithubIdentityResponse)
def set_github_identity(
    body: GithubIdentityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Valida contra os repos das Applications a que o utilizador já tem ApplicationTeamMember,
    quando existir pelo menos uma — sem nenhuma, aceita sem validar (o gate de Deploy/Rollback
    apanha o erro na prática mais tarde)."""
    repos = (
        db.query(Application.source_repository)
        .join(ApplicationTeamMember, ApplicationTeamMember.application_id == Application.id)
        .join(TeamMember, TeamMember.id == ApplicationTeamMember.team_member_id)
        .filter(TeamMember.user_id == current_user.id)
        .distinct()
        .all()
    )
    if repos and not any(is_repo_collaborator(repo, body.github_username) for (repo,) in repos):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este username GitHub não é colaborador em nenhuma das tuas applications.",
        )

    # A GitHub username/account email belongs to exactly one person — two DevShip
    # accounts must never share one, or deploy/rollback attribution becomes meaningless.
    claimed = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            (User.github_username == body.github_username) | (User.github_email == body.github_email),
        )
        .first()
    )
    if claimed is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta identidade GitHub já está associada a outra conta DevShip.",
        )

    current_user.github_username = body.github_username
    current_user.github_email = body.github_email
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta identidade GitHub já está associada a outra conta DevShip.",
        )
    db.commit()
    return GithubIdentityResponse(github_username=current_user.github_username, github_email=current_user.github_email)


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


@router.get("/teams/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _require_team_reader(db, team_id, current_user)


@router.patch("/teams/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: uuid.UUID,
    body: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _require_cloud_engineer_of_team(db, team_id, current_user)
    if body.name is not None:
        team.name = body.name
    if body.description is not None:
        team.description = body.description
    db.commit()
    db.refresh(team)
    return team


# ---------------------------------------------------------------------------
# Team members — list (existing + pending candidates) + add
# ---------------------------------------------------------------------------

def _member_entry(db: Session, m: TeamMember, u: User) -> MemberEntry:
    application_ids = [
        row[0]
        for row in db.query(ApplicationTeamMember.application_id)
        .filter(ApplicationTeamMember.team_member_id == m.id)
        .all()
    ]
    return MemberEntry(
        team_member_id=m.id, user_id=m.user_id, name=u.name, email=u.email,
        role=m.role, joined_at=m.joined_at, application_ids=application_ids,
    )


@router.get("/teams/{team_id}/members")
def list_team_members(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _require_team_reader(db, team_id, current_user)

    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    member_entries = [_member_entry(db, m, db.get(User, m.user_id)) for m in members]

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
    _, caller = _require_team_manager(db, team_id, current_user)

    # A Tech Lead can only add Developers — promoting straight to Tech Lead or
    # Cloud Engineer is reserved for the Cloud Engineer (mirrors _require_manageable_target,
    # which applies the same rule to edits of an existing member).
    if caller.role == TeamMemberRole.TECH_LEAD and body.role != TeamMemberRole.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Um Tech Lead só pode adicionar membros como Developer.",
        )

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

    if body.role == TeamMemberRole.DEVELOPER:
        for app_id in body.application_ids:
            db.add(ApplicationTeamMember(team_member_id=member.id, application_id=app_id))
    db.commit()

    return _member_entry(db, member, target)


def _get_team_member_or_404(db: Session, team_id: uuid.UUID, team_member_id: uuid.UUID) -> TeamMember:
    target = db.get(TeamMember, team_member_id)
    if target is None or target.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TeamMember not found")
    return target


def _require_manageable_target(caller: TeamMember, target: TeamMember) -> None:
    """CLOUD_ENGINEER pode gerir qualquer membro. TECH_LEAD só pode gerir DEVELOPERs —
    não pode editar/remover outro TECH_LEAD nem o CLOUD_ENGINEER."""
    if caller.role == TeamMemberRole.TECH_LEAD and target.role != TeamMemberRole.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Um Tech Lead só pode gerir Developers.",
        )


@router.patch("/teams/{team_id}/members/{team_member_id}", response_model=MemberEntry)
def update_team_member(
    team_id: uuid.UUID,
    team_member_id: uuid.UUID,
    body: PatchMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, caller = _require_team_manager(db, team_id, current_user)
    target = _get_team_member_or_404(db, team_id, team_member_id)
    _require_manageable_target(caller, target)

    if body.role is not None:
        if body.role != TeamMemberRole.DEVELOPER:
            db.query(ApplicationTeamMember).filter(ApplicationTeamMember.team_member_id == target.id).delete()
        else:
            if body.application_ids is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="application_ids é obrigatório ao mudar para DEVELOPER.",
                )
        target.role = body.role

    if body.application_ids is not None and target.role == TeamMemberRole.DEVELOPER:
        db.query(ApplicationTeamMember).filter(ApplicationTeamMember.team_member_id == target.id).delete()
        for app_id in body.application_ids:
            db.add(ApplicationTeamMember(team_member_id=target.id, application_id=app_id))

    db.commit()
    db.refresh(target)
    return _member_entry(db, target, db.get(User, target.user_id))


@router.delete("/teams/{team_id}/members/{team_member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: uuid.UUID,
    team_member_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, caller = _require_team_manager(db, team_id, current_user)
    target = _get_team_member_or_404(db, team_id, team_member_id)
    _require_manageable_target(caller, target)

    if target.role == TeamMemberRole.CLOUD_ENGINEER:
        other_ce_count = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.role == TeamMemberRole.CLOUD_ENGINEER,
                TeamMember.id != target.id,
            )
            .count()
        )
        if other_ce_count == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team precisa de um Cloud Engineer.")

    db.delete(target)
    db.commit()


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


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
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
        argocd_namespace=body.argocd_namespace or "argocd",
        last_validated_at=datetime.now(timezone.utc),
    )
    db.add(cluster)
    project.setup_status = SetupStatus.PENDING_ENVIRONMENTS
    db.commit()
    db.refresh(cluster)
    return cluster


def _get_cluster_or_404(db: Session, project_id: uuid.UUID) -> ClusterContext:
    cluster = db.query(ClusterContext).filter(ClusterContext.project_id == project_id).first()
    if cluster is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster ainda não configurado.")
    return cluster


@router.post("/projects/{project_id}/cluster/revalidate", response_model=ClusterContextResponse)
def revalidate_cluster(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-runs the same STS/EKS/K8s checks as initial setup against the stored credentials,
    without changing them — surfaces drift (expired role, revoked access entry, etc.)."""
    _require_cloud_engineer(db, project_id, current_user)
    cluster = _get_cluster_or_404(db, project_id)

    # last_validated_at tracks the last validation attempt, not the last success — a
    # failed attempt is still an attempt, and leaving the timestamp stuck at the last
    # success would make a cluster that's been unreachable for days look freshly checked.
    try:
        cv.validate_cluster(cluster.cluster_arn, cluster.iam_role_arn, cluster.external_id)
    except ValueError as e:
        cluster.last_validated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    cluster.last_validated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cluster)
    return cluster


@router.get("/projects/{project_id}/cluster/rbac-check", response_model=RbacCheckResponse)
def check_cluster_rbac(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tests, without blocking onboarding, whether ArgoCD and Metrics API RBAC is already
    mounted — distinct from validate_cluster (core API only). Called on demand, never
    automatically, since Cloud Engineers typically leave this page, configure via AWS/kubectl,
    and come back to test."""
    _require_cloud_engineer(db, project_id, current_user)
    cluster = _get_cluster_or_404(db, project_id)
    rbac_subject = compute_rbac_subject(cluster.iam_role_arn)

    try:
        eks_info = _get_cluster_token(cluster)
    except ValueError as e:
        msg = str(e)
        return RbacCheckResponse(rbac_subject=rbac_subject, argocd_ok=False, argocd_error=msg, metrics_ok=False, metrics_error=msg)

    argocd_ok, argocd_error = True, None
    try:
        check_argocd_access(eks_info, cluster.argocd_namespace)
    except Exception:
        argocd_ok = False
        argocd_error = "Sem acesso às Applications do ArgoCD — falta o ClusterRoleBinding para applications.argoproj.io."

    metrics_ok, metrics_error = True, None
    try:
        check_metrics_access(eks_info)
    except Exception:
        metrics_ok = False
        metrics_error = "Sem acesso ao Metrics API — falta o ClusterRoleBinding para metrics.k8s.io, ou o metrics-server não está instalado."

    return RbacCheckResponse(rbac_subject=rbac_subject, argocd_ok=argocd_ok, argocd_error=argocd_error, metrics_ok=metrics_ok, metrics_error=metrics_error)


@router.patch("/projects/{project_id}/cluster", response_model=ClusterContextResponse)
def update_cluster_credentials(
    project_id: uuid.UUID,
    body: ClusterConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replaces cluster_arn/iam_role_arn — validated against the same checks as initial
    setup before anything is persisted, so a bad edit can't brick the stored credentials."""
    project = _require_cloud_engineer(db, project_id, current_user)
    cluster = _get_cluster_or_404(db, project_id)

    try:
        info = cv.validate_cluster(body.cluster_arn, body.iam_role_arn, cluster.external_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    cluster.cluster_arn = body.cluster_arn
    cluster.iam_role_arn = body.iam_role_arn
    cluster.cluster_name = info.name
    cluster.region = info.region
    cluster.eks_endpoint = info.endpoint
    cluster.ca_certificate = info.ca_certificate
    cluster.ca_file_path = info.ca_file_path
    if body.argocd_namespace:
        cluster.argocd_namespace = body.argocd_namespace
    cluster.last_validated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cluster)
    return cluster


# ---------------------------------------------------------------------------
# Archive project
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/archive", response_model=ProjectResponse)
def archive_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _require_cloud_engineer(db, project_id, current_user)
    if not project.is_archived:
        project.is_archived = True
        project.archived_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(project)
    return project


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
        except Exception:
            logger.exception("_run_environment_validations: namespace check failed (namespace=%s)", env.namespace)
            v.namespace_status = ValidationStatus.INVALID
            v.namespace_error = "Erro ao validar o namespace no cluster."
    else:
        v.namespace_status = ValidationStatus.VALID  # skipped — no cluster yet or no namespace set

    # 2. Branch check via GitHub — gitops_branch, this validates the GitOps repo, not the app repo
    if git_ops_url and env.gitops_branch:
        try:
            ok = validate_branch(git_ops_url, env.gitops_branch)
            v.branch_status = ValidationStatus.VALID if ok else ValidationStatus.INVALID
            if not ok:
                v.branch_error = f"Branch '{env.gitops_branch}' not found in {git_ops_url}"
        except Exception:
            logger.exception("_run_environment_validations: branch check failed (branch=%s)", env.gitops_branch)
            v.branch_status = ValidationStatus.INVALID
            v.branch_error = "Erro ao validar a branch no repositório GitOps."
    else:
        v.branch_status = ValidationStatus.VALID

    # 3. GitOps path check via GitHub
    if git_ops_url and env.git_ops_base_path and env.gitops_branch:
        try:
            ok = path_exists(git_ops_url, env.git_ops_base_path, env.gitops_branch)
            v.git_ops_path_status = ValidationStatus.VALID if ok else ValidationStatus.INVALID
            if not ok:
                v.git_ops_path_error = f"Path '{env.git_ops_base_path}' not found on branch '{env.gitops_branch}'"
        except Exception:
            logger.exception("_run_environment_validations: GitOps path check failed (path=%s)", env.git_ops_base_path)
            v.git_ops_path_status = ValidationStatus.INVALID
            v.git_ops_path_error = "Erro ao validar o caminho no repositório GitOps."
    else:
        v.git_ops_path_status = ValidationStatus.VALID

    # 4. ArgoCD Application existence check — confirms the configured name actually
    # exists in the cluster's ArgoCD namespace, instead of only discovering a typo
    # 15+ minutes into a real deploy.
    if cluster and env.argocd_application_name:
        try:
            eks_info = _get_cluster_token(cluster)
            get_argocd_application(eks_info, env.argocd_application_name, cluster.argocd_namespace)
            v.argocd_status = ValidationStatus.VALID
        except KubernetesNotFoundError:
            v.argocd_status = ValidationStatus.INVALID
            v.argocd_error = f"ArgoCD Application '{env.argocd_application_name}' not found in namespace '{cluster.argocd_namespace}'"
        except Exception:
            logger.exception(
                "_run_environment_validations: ArgoCD Application check failed (application=%s)",
                env.argocd_application_name,
            )
            v.argocd_status = ValidationStatus.INVALID
            v.argocd_error = "Erro ao validar a Application no ArgoCD."
    else:
        v.argocd_status = ValidationStatus.VALID  # skipped — no cluster yet or no ArgoCD name set

    all_valid = all(
        s == ValidationStatus.VALID
        for s in (v.namespace_status, v.branch_status, v.git_ops_path_status, v.argocd_status)
    )
    v.overall_status = ValidationStatus.VALID if all_valid else ValidationStatus.INVALID
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


@router.patch("/projects/{project_id}/environments/{environment_id}", response_model=EnvironmentResponse)
def update_environment(
    project_id: uuid.UUID,
    environment_id: uuid.UUID,
    body: EnvironmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edits an existing Environment and re-runs the same namespace/branch/gitops-path
    checks used at onboarding time before persisting — an edit that breaks the config
    fails the request with the validation errors, same as creation."""
    project = _require_cloud_engineer(db, project_id, current_user)
    env = db.get(Environment, environment_id)
    if env is None or env.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(env, field, value)
    db.flush()

    cluster = db.query(ClusterContext).filter(ClusterContext.project_id == project_id).first()
    validation = db.query(EnvironmentValidation).filter(EnvironmentValidation.environment_id == env.id).first()
    if validation is None:
        validation = EnvironmentValidation(environment_id=env.id)
        db.add(validation)
    _run_environment_validations(validation, env, cluster, project.git_ops_repository_url)

    if validation.overall_status != ValidationStatus.VALID:
        # Build the response payload before rolling back — db.rollback() expires every
        # object in the session, so reading `validation`'s attributes afterwards would
        # silently re-fetch the pre-mutation (stale) row instead of what was just computed.
        detail = EnvironmentValidationResult.model_validate(validation).model_dump_json()
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

    db.commit()
    db.refresh(env)
    return _env_response(env, validation)


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
            detail="O projeto não tem um repositório GitOps configurado.",
        )

    environments = db.query(Environment).filter(Environment.project_id == project_id).all()
    env_paths = [(e.name, e.git_ops_base_path) for e in environments if e.git_ops_base_path]

    try:
        candidates = gs.scan_gitops_repo(project.git_ops_repository_url, env_paths)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    return [GitOpsScanResult(**c) for c in candidates]


@router.get("/projects/{project_id}/workflow-files", response_model=list[str])
def list_workflow_files_for_repo(
    project_id: uuid.UUID,
    source_repository: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_cloud_engineer(db, project_id, current_user)
    try:
        return gs.list_workflow_files(source_repository)
    except Exception:
        # rate limit, repo inacessível, etc. — não bloquear o onboarding por isto,
        # o frontend cai para o input manual.
        return []


@router.get("/projects/{project_id}/file-preview")
def preview_file(
    project_id: uuid.UUID,
    repo_url: str = Query(...),
    path: str = Query(...),
    ref: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_cloud_engineer(db, project_id, current_user)
    content = gs.get_file_content(repo_url, path, ref)
    if content is None:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado ou inacessível.")
    return {"content": content}


@router.get("/projects/{project_id}/dir-preview")
def preview_directory(
    project_id: uuid.UUID,
    repo_url: str = Query(...),
    path: str = Query(...),
    ref: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_cloud_engineer(db, project_id, current_user)
    try:
        return gs.list_directory(repo_url, path, ref)
    except Exception:
        # rate limit, repo inacessível, etc. — devolve vazio, o frontend mostra "sem entradas".
        return []


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
        # Upsert by source_repository (globally unique) — idempotent on re-submit,
        # e.g. navigating back and forth in onboarding before finishing it.
        app = db.query(Application).filter(Application.source_repository == item.source_repository).first()
        if app is not None and app.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"source_repository '{item.source_repository}' already belongs to another project",
            )
        if app is None:
            app = Application(project_id=project_id, source_repository=item.source_repository, created_by=current_user.id)
            db.add(app)

        app.name = item.name
        app.ci_workflow_file = item.ci_workflow_file
        db.flush()

        for ae in item.environments:
            app_env = db.query(ApplicationEnvironment).filter(
                ApplicationEnvironment.application_id == app.id,
                ApplicationEnvironment.environment_id == ae.environment_id,
            ).first()
            if app_env is None:
                app_env = ApplicationEnvironment(application_id=app.id, environment_id=ae.environment_id)
                db.add(app_env)
            app_env.deployment_name = ae.deployment_name
            app_env.manifest_path = ae.manifest_path

        created.append(app)

    project.setup_status = SetupStatus.CONFIGURED
    db.commit()
    return created


@router.patch("/applications/{app_id}", response_model=ApplicationResponse)
def update_application(
    app_id: uuid.UUID,
    body: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edits an Application. If source_repository changes, checks the repo actually
    exists on GitHub before persisting — a typo'd repo would otherwise silently break
    every future deploy/rollback for this application."""
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    _require_cloud_engineer(db, app.project_id, current_user)

    data = body.model_dump(exclude_unset=True)

    new_repo = data.get("source_repository")
    if new_repo is not None and new_repo != app.source_repository:
        if not repo_exists(new_repo):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Repositório '{new_repo}' não encontrado no GitHub.",
            )

    for field, value in data.items():
        setattr(app, field, value)

    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"source_repository '{new_repo}' already belongs to another project",
        )

    db.commit()
    db.refresh(app)
    return app
