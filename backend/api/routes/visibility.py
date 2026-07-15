import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from backend.api.authorization import _require_application_access, _require_project_member
from backend.api.deps import get_current_user, get_db
from backend.api.schemas.visibility import (
    ApplicationDetailResponse,
    ApplicationEnvironmentDetail,
    ApplicationEnvironmentStatus,
    ApplicationListItem,
    ApplicationWithStatus,
    DeploymentVersionDetail,
    EnvironmentListItem,
    HomepageResponse,
    K8sEvent,
    LogLine,
    LogsResponse,
    ContainerProbeStatus,
    HealthProbesResponse,
    PendingCommit,
    PendingCommitsResponse,
    PodListResponse,
    PodStatus,
    ProjectSummary,
    UpToDateResponse,
    UpToDateStatus,
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.deployment_event import DeploymentEvent
from backend.bd.models.deployment_request import DeploymentRequest
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMemberRole
from backend.bd.models.user import User
from backend.services.cluster_validation import get_cluster_token
from backend.services.deploy_pipeline import compute_lifecycle_status
from backend.services.eks_discovery import EKSClusterInfo
from backend.services.gitops_scanner import compare_commits, resolve_branch_head, resolve_path_head
from backend.services.kubernetes_reader import (
    container_probe_statuses,
    get_pod_logs,
    list_events_in_namespace,
    list_pods_in_namespace,
    pod_health_snapshot,
    pod_metrics,
)

router = APIRouter(tags=["visibility"])
logger = logging.getLogger(__name__)

_TERMINAL_STATUSES = {LifecycleStatus.FAILED, LifecycleStatus.ROLLED_BACK, LifecycleStatus.SUPERSEDED}


def _refresh_lifecycle_from_events(db: Session, versions: list[DeploymentVersion]) -> None:
    """
    Recompute lifecycle_status from stored events for non-terminal versions. No K8s call.
    Skips any version whose last live cluster check (health_checked_at, set by the manual
    refresh endpoint) is newer than its latest event — otherwise this would silently
    overwrite "cluster is unreachable/degraded" with a stale Healthy derived from old events
    every time the page reloads.
    """
    pending = [v for v in versions if v.lifecycle_status not in _TERMINAL_STATUSES]
    if not pending:
        return
    events_by_version: dict[uuid.UUID, list[DeploymentEvent]] = {v.id: [] for v in pending}
    for e in (
        db.query(DeploymentEvent)
        .filter(DeploymentEvent.deployment_version_id.in_(events_by_version.keys()))
        .all()
    ):
        events_by_version[e.deployment_version_id].append(e)
    dirty = False
    for v in pending:
        events = events_by_version[v.id]
        latest_event_ts = max((e.event_timestamp for e in events), default=None)
        if v.health_checked_at is not None and (latest_event_ts is None or v.health_checked_at >= latest_event_ts):
            continue  # a live check is more recent than any event — trust it
        new_status = compute_lifecycle_status(events)
        if new_status != v.lifecycle_status:
            v.lifecycle_status = new_status
            dirty = True
    if dirty:
        db.commit()


def _get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return p


@router.get("/projects/{project_id}", response_model=ProjectSummary)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    _require_project_member(db, project_id, current_user)
    team = db.get(Team, project.team_id)
    return ProjectSummary(
        id=project.id, name=project.name, description=project.description,
        git_ops_repository_url=project.git_ops_repository_url, team_name=team.name if team else "",
    )


def _get_ae_or_404(db: Session, ae_id: uuid.UUID, current_user: User) -> ApplicationEnvironment:
    ae = db.get(ApplicationEnvironment, ae_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")
    _require_application_access(db, ae.application_id, current_user)
    return ae


def _resolve_cluster_and_namespace(db: Session, ae: ApplicationEnvironment) -> tuple[EKSClusterInfo, str]:
    """Live-read prerequisite shared by refresh/pods/logs/events: auth to the project's
    cluster and resolve the environment's namespace. Raises HTTPException(503) if unset up."""
    env = db.get(Environment, ae.environment_id)
    cluster_ctx = db.query(ClusterContext).filter(ClusterContext.project_id == env.project_id).first()
    if cluster_ctx is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cluster não configurado")
    try:
        eks_info = get_cluster_token(
            iam_role_arn=cluster_ctx.iam_role_arn,
            external_id=cluster_ctx.external_id,
            cluster_arn=cluster_ctx.cluster_arn,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    namespace = env.namespace or env.name.lower()
    return eks_info, namespace


def _latest_versions_subquery(db: Session, app_env_ids: list[uuid.UUID] | None = None):
    """DISTINCT ON (application_environment_id) — latest DeploymentVersion per ae. PostgreSQL-specific."""
    q = (
        db.query(DeploymentVersion)
        .order_by(
            DeploymentVersion.application_environment_id,
            desc(DeploymentVersion.created_at),
        )
        .distinct(DeploymentVersion.application_environment_id)
    )
    if app_env_ids is not None:
        q = q.filter(DeploymentVersion.application_environment_id.in_(app_env_ids))
    return q


# ---------------------------------------------------------------------------
# GET /projects/{id}/environments
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/environments", response_model=list[EnvironmentListItem])
def list_environments(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _require_project_member(db, project_id, current_user)
    query = db.query(Environment).filter(Environment.project_id == project_id, Environment.is_archived.is_(False))

    if member.role == TeamMemberRole.CLOUD_ENGINEER:
        envs = query.order_by(Environment.deployment_order).all()
    else:
        query = query.join(ApplicationEnvironment, ApplicationEnvironment.environment_id == Environment.id)
        if member.role == TeamMemberRole.DEVELOPER:
            query = (
                query.join(Application, ApplicationEnvironment.application_id == Application.id)
                .join(ApplicationTeamMember, ApplicationTeamMember.application_id == Application.id)
                .filter(ApplicationTeamMember.team_member_id == member.id)
            )
        envs = query.distinct().order_by(Environment.deployment_order).all()

    names_by_env: dict[uuid.UUID, list[str]] = {e.id: [] for e in envs}
    if envs:
        for env_id, app_name in (
            db.query(ApplicationEnvironment.environment_id, Application.name)
            .join(Application, ApplicationEnvironment.application_id == Application.id)
            .filter(ApplicationEnvironment.environment_id.in_(names_by_env.keys()))
            .all()
        ):
            names_by_env[env_id].append(app_name)

    result = []
    for e in envs:
        item = EnvironmentListItem.model_validate(e)
        item.application_names = names_by_env[e.id]
        result.append(item)
    return result


# ---------------------------------------------------------------------------
# GET /projects/{id}/applications
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/applications", response_model=list[ApplicationListItem])
def list_applications(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _require_project_member(db, project_id, current_user)
    query = db.query(Application).filter(
        Application.project_id == project_id, Application.is_archived.is_(False)
    )
    if member.role == TeamMemberRole.DEVELOPER:
        query = query.join(
            ApplicationTeamMember, ApplicationTeamMember.application_id == Application.id
        ).filter(ApplicationTeamMember.team_member_id == member.id)
    return query.order_by(Application.name).all()


# ---------------------------------------------------------------------------
# GET /applications/{id}
# ---------------------------------------------------------------------------

@router.get("/applications/{app_id}", response_model=ApplicationDetailResponse)
def get_application(
    app_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_application_access(db, app_id, current_user)
    app = db.get(Application, app_id)

    app_envs = (
        db.query(ApplicationEnvironment)
        .filter(ApplicationEnvironment.application_id == app_id)
        .all()
    )
    ae_ids = [ae.id for ae in app_envs]

    latest_versions = _latest_versions_subquery(db, ae_ids).all()
    _refresh_lifecycle_from_events(db, latest_versions)
    latest_by_ae = {v.application_environment_id: v for v in latest_versions}

    # Need env names — one query
    envs = {
        e.id: e
        for e in db.query(Environment)
        .filter(Environment.id.in_([ae.environment_id for ae in app_envs]))
        .all()
    }

    environments = [
        ApplicationEnvironmentStatus(
            id=ae.id,
            environment_name=envs[ae.environment_id].name,
            lifecycle_status=latest_by_ae[ae.id].lifecycle_status if ae.id in latest_by_ae else None,
        )
        for ae in app_envs
    ]

    return ApplicationDetailResponse(
        id=app.id,
        name=app.name,
        source_repository=app.source_repository,
        description=app.description,
        environments=environments,
    )


# ---------------------------------------------------------------------------
# GET /application-environments/{id}
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}", response_model=ApplicationEnvironmentDetail)
def get_application_environment(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    if latest is not None:
        _refresh_lifecycle_from_events(db, [latest])

    current_version = None
    discovered_status = None
    if latest is not None:
        current_version = DeploymentVersionDetail.model_validate(latest)
        if latest.deployment_request_id is not None:
            req = db.get(DeploymentRequest, latest.deployment_request_id)
            if req is not None and req.requested_by is not None:
                requester = db.get(User, req.requested_by)
                if requester is not None:
                    current_version.requested_by_email = requester.email
    else:
        discovered_status = None

    return ApplicationEnvironmentDetail(
        id=ae.id,
        application_id=ae.application_id,
        environment_id=ae.environment_id,
        deployment_name=ae.deployment_name,
        is_archived=ae.is_archived,
        archived_at=ae.archived_at,
        current_version=current_version,
        discovered_status=discovered_status,
    )


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/archive
# ---------------------------------------------------------------------------

@router.post("/application-environments/{ae_id}/archive", response_model=ApplicationEnvironmentDetail)
def archive_application_environment(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = db.get(ApplicationEnvironment, ae_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")
    member = _require_application_access(db, ae.application_id, current_user)
    if member.role != TeamMemberRole.CLOUD_ENGINEER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="É necessário ter o papel de Cloud Engineer para executar esta ação.")

    if not ae.is_archived:
        ae.is_archived = True
        ae.archived_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(ae)

    return ApplicationEnvironmentDetail(
        id=ae.id,
        application_id=ae.application_id,
        environment_id=ae.environment_id,
        deployment_name=ae.deployment_name,
        is_archived=ae.is_archived,
        archived_at=ae.archived_at,
    )


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/history
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/history", response_model=list[DeploymentVersionDetail])
def get_ae_history(
    ae_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_ae_or_404(db, ae_id, current_user)

    return (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.application_environment_id == ae_id)
        .order_by(desc(DeploymentVersion.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/refresh — live K8s read, manual only
# ---------------------------------------------------------------------------

@router.post("/application-environments/{ae_id}/refresh", response_model=ApplicationEnvironmentDetail)
def refresh_application_environment(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Live pod read for the current version's health — only source that catches a pod
    that died and restarted between deploys, since no observer runs after a request ends."""
    ae = _get_ae_or_404(db, ae_id, current_user)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    if latest is not None and latest.lifecycle_status not in _TERMINAL_STATUSES:
        env = db.get(Environment, ae.environment_id)
        cluster_ctx = db.query(ClusterContext).filter(ClusterContext.project_id == env.project_id).first()
        if cluster_ctx is None:
            # No cluster configured at all — can't claim Healthy with nothing to check.
            latest.lifecycle_status = LifecycleStatus.DEGRADED
        else:
            try:
                eks_info = get_cluster_token(
                    iam_role_arn=cluster_ctx.iam_role_arn,
                    external_id=cluster_ctx.external_id,
                    cluster_arn=cluster_ctx.cluster_arn,
                )
                namespace = env.namespace or env.name.lower()
                any_ready, fatal_pods = pod_health_snapshot(eks_info, namespace, ae.deployment_name)
                latest.lifecycle_status = LifecycleStatus.HEALTHY if (any_ready and not fatal_pods) else LifecycleStatus.DEGRADED
            except Exception:
                # Cluster unreachable (destroyed, auth broken, network down, ...) — this is
                # itself a health signal, not a no-op. Silently keeping the last known status
                # would show "Healthy" for a cluster that no longer exists.
                latest.lifecycle_status = LifecycleStatus.DEGRADED
        latest.health_checked_at = datetime.now(timezone.utc)
        db.commit()

    return ApplicationEnvironmentDetail(
        id=ae.id,
        application_id=ae.application_id,
        environment_id=ae.environment_id,
        deployment_name=ae.deployment_name,
        is_archived=ae.is_archived,
        archived_at=ae.archived_at,
        current_version=DeploymentVersionDetail.model_validate(latest) if latest else None,
    )


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/pods — live K8s read
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/pods", response_model=PodListResponse)
def get_pods(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)
    eks_info, namespace = _resolve_cluster_and_namespace(db, ae)

    pod_list = list_pods_in_namespace(eks_info, namespace)

    metrics_available = True
    try:
        metrics = pod_metrics(eks_info, namespace)
    except Exception:
        logger.exception("get_pods: pod_metrics failed for namespace %s", namespace)
        metrics_available = False
        metrics = {}

    pods = [
        PodStatus(
            name=p.metadata.name,
            phase=p.status.phase,
            ready=f"{p.status.ready_count}/{p.status.container_count}",
            restart_count=p.status.restart_count,
            node_name=p.spec.node_name,
            creation_timestamp=p.metadata.creation_timestamp,
            cpu=metrics.get(p.metadata.name, {}).get("cpu"),
            memory=metrics.get(p.metadata.name, {}).get("memory"),
        )
        for p in pod_list.items
    ]
    return PodListResponse(pods=pods, metrics_available=metrics_available)


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/health-probes — live K8s read
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/health-probes", response_model=HealthProbesResponse)
def get_health_probes(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)
    eks_info, namespace = _resolve_cluster_and_namespace(db, ae)
    containers = container_probe_statuses(eks_info, namespace, ae.deployment_name)
    return HealthProbesResponse(containers=[ContainerProbeStatus(**c) for c in containers])


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/events — live K8s read
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/events", response_model=list[K8sEvent])
def get_events(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)
    eks_info, namespace = _resolve_cluster_and_namespace(db, ae)

    event_list = list_events_in_namespace(eks_info, namespace)
    return [
        K8sEvent(
            type=e.type,
            reason=e.reason,
            object_ref=e.object_ref,
            message=e.message,
            last_timestamp=e.last_timestamp,
        )
        for e in event_list.items
    ]


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/logs?pod=...&tail=... — live K8s read
# ---------------------------------------------------------------------------

# ISO-ish timestamp ("2024-01-05T16:03:05" or "16:03:05") followed by an optional
# level word, then the rest of the line. Best-effort per line — no match means "RAW".
_LOG_LINE_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}:\d{2}:\d{2})?"
    r"\s*(?P<level>DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)?\s*[:\-]?\s*(?P<msg>.*)$",
    re.IGNORECASE,
)


def _parse_log_line(line: str) -> LogLine:
    m = _LOG_LINE_RE.match(line)
    if not m or (not m.group("ts") and not m.group("level")):
        return LogLine(timestamp=None, level="RAW", message=line)
    return LogLine(
        timestamp=m.group("ts"),
        level=m.group("level").upper() if m.group("level") else None,
        message=m.group("msg") or line,
    )


@router.get("/application-environments/{ae_id}/logs", response_model=LogsResponse)
def get_logs(
    ae_id: uuid.UUID,
    pod: str = Query(..., description="Pod name — from GET .../pods"),
    tail: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)
    eks_info, namespace = _resolve_cluster_and_namespace(db, ae)

    raw = get_pod_logs(eks_info, namespace, pod, tail_lines=tail)
    lines = [_parse_log_line(line) for line in raw.splitlines() if line]
    return LogsResponse(pod_name=pod, lines=lines)


# ---------------------------------------------------------------------------
# GET /projects/{id}/homepage
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/homepage", response_model=HomepageResponse)
def get_homepage(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _require_project_member(db, project_id, current_user)

    accessible_apps_query = db.query(Application.id).filter(
        Application.project_id == project_id, Application.is_archived.is_(False)
    )
    if member.role == TeamMemberRole.DEVELOPER:
        accessible_apps_query = accessible_apps_query.join(
            ApplicationTeamMember, ApplicationTeamMember.application_id == Application.id
        ).filter(ApplicationTeamMember.team_member_id == member.id)
    accessible_app_ids = [row[0] for row in accessible_apps_query.all()]

    # All app_envs for these accessible applications
    app_env_ids: list[uuid.UUID] = [
        row[0]
        for row in db.query(ApplicationEnvironment.id)
        .filter(ApplicationEnvironment.application_id.in_(accessible_app_ids), ApplicationEnvironment.is_archived.is_(False))
        .all()
    ] if accessible_app_ids else []

    total_ae = len(app_env_ids)

    if app_env_ids:
        _refresh_lifecycle_from_events(db, _latest_versions_subquery(db, app_env_ids).all())
        latest_sq = _latest_versions_subquery(db, app_env_ids).subquery()
        counts = db.query(
            func.count().label("total"),
            func.count(case((latest_sq.c.lifecycle_status == LifecycleStatus.HEALTHY, 1))).label("healthy"),
            func.count(case((latest_sq.c.lifecycle_status == LifecycleStatus.DEGRADED, 1))).label("degraded"),
        ).select_from(latest_sq).one()
        healthy_count = counts.healthy
        degraded_count = counts.degraded
    else:
        healthy_count = 0
        degraded_count = 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    deploys_today = (
        db.query(func.count(DeploymentVersion.id))
        .filter(DeploymentVersion.created_at >= today_start)
        .scalar()
    ) or 0

    # Build applications list with per-ae status
    apps = (
        db.query(Application)
        .filter(Application.id.in_(accessible_app_ids))
        .order_by(Application.name)
        .all()
    ) if accessible_app_ids else []

    latest_by_ae = (
        {v.application_environment_id: v for v in _latest_versions_subquery(db, app_env_ids).all()}
        if app_env_ids else {}
    )

    all_ae = (
        db.query(ApplicationEnvironment)
        .filter(ApplicationEnvironment.application_id.in_([a.id for a in apps]), ApplicationEnvironment.is_archived.is_(False))
        .all()
    ) if apps else []

    env_names = {
        e.id: e.name
        for e in db.query(Environment)
        .filter(Environment.id.in_({ae.environment_id for ae in all_ae}))
        .all()
    } if all_ae else {}

    ae_by_app: dict[uuid.UUID, list[ApplicationEnvironment]] = {}
    for ae in all_ae:
        ae_by_app.setdefault(ae.application_id, []).append(ae)

    # AEs with no DeploymentVersion yet (nothing deployed via DevShip) — Unknown, no
    # live cluster read (reverted: was making the homepage slow, see refresh button instead).
    undeployed_ae = [ae for ae in all_ae if ae.id not in latest_by_ae]
    discovered_by_ae = {ae.id: None for ae in undeployed_ae}

    applications = [
        ApplicationWithStatus(
            id=app.id,
            name=app.name,
            environments=[
                ApplicationEnvironmentStatus(
                    id=ae.id,
                    environment_name=env_names.get(ae.environment_id, ""),
                    lifecycle_status=latest_by_ae[ae.id].lifecycle_status if ae.id in latest_by_ae else None,
                    discovered_status=discovered_by_ae.get(ae.id),
                )
                for ae in ae_by_app.get(app.id, [])
            ],
        )
        for app in apps
    ]

    return HomepageResponse(
        total_application_environments=total_ae,
        healthy_count=healthy_count,
        degraded_count=degraded_count,
        deploys_today=deploys_today,
        applications=applications,
    )


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/up-to-date — DEV-10.3, one live GitHub call
# ---------------------------------------------------------------------------

def compute_up_to_date(deployed_source_commit_sha: str | None, source_head_sha: str | None) -> UpToDateStatus:
    """Pure: three-state comparison. A missing input on either side means we can't
    know — never collapse that into Outdated, that would read as a false alarm."""
    if deployed_source_commit_sha is None or source_head_sha is None:
        return UpToDateStatus.UNKNOWN
    return UpToDateStatus.UP_TO_DATE if deployed_source_commit_sha == source_head_sha else UpToDateStatus.OUTDATED


@router.get("/application-environments/{ae_id}/up-to-date", response_model=UpToDateResponse)
def get_up_to_date(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    if latest is None or latest.source_commit_sha is None:
        return UpToDateResponse(status=UpToDateStatus.UNKNOWN, reason="Sem deploys ainda")

    # Compara o commit desta versão contra o HEAD do repositório SOURCE da application
    # (não o GitOps) — é o mesmo par que o utilizador vê em "Commit desta versão" no
    # EnvDetail e no ecrã de Deploy ("pending-commits"), por isso tem de vir da mesma
    # fonte para os dois lados nunca contarem histórias diferentes.
    env = db.get(Environment, ae.environment_id)
    app = db.get(Application, ae.application_id)
    project = db.get(Project, app.project_id)
    branch = env.source_branch or "main"

    head_sha = resolve_branch_head(app.source_repository, branch)
    if head_sha is None:
        return UpToDateResponse(
            status=UpToDateStatus.UNKNOWN,
            reason="Não foi possível resolver o HEAD da branch via GitHub",
        )

    response = UpToDateResponse(
        status=compute_up_to_date(latest.source_commit_sha, head_sha),
        source_head_sha=head_sha,
        argocd_sync_revision=latest.argocd_sync_revision,
    )

    # Drift do GitOps — eixo independente do "up to date" de código. Só é calculável com
    # manifest_path (do onboarding) e gitops_branch (da configuração do Environment); sem
    # qualquer um dos dois, fica Unknown — nunca um alarme falso por falta de dados.
    if not ae.manifest_path or not env.gitops_branch or not project.git_ops_repository_url:
        response.gitops_reason = "manifest_path, gitops_branch ou git_ops_repository_url em falta"
        return response

    path_head = resolve_path_head(project.git_ops_repository_url, env.gitops_branch, ae.manifest_path)
    if path_head is None:
        response.gitops_reason = "Não foi possível resolver o histórico do manifesto via GitHub"
        return response

    response.gitops_drift_status = compute_up_to_date(latest.argocd_sync_revision, path_head)
    response.gitops_path_head_sha = path_head
    return response


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/pending-commits — commits that would ship on deploy
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/pending-commits", response_model=PendingCommitsResponse)
def get_pending_commits(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id, current_user)
    app = db.get(Application, ae.application_id)
    env = db.get(Environment, ae.environment_id)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    current_sha = latest.source_commit_sha if latest else None
    if current_sha is None:
        return PendingCommitsResponse(reason="Sem deploy anterior — nada para comparar")

    branch = env.source_branch or "main"
    commits = compare_commits(app.source_repository, current_sha, branch)
    if commits is None:
        return PendingCommitsResponse(
            current_sha=current_sha,
            reason="Não foi possível obter os commits via GitHub",
        )

    return PendingCommitsResponse(
        current_sha=current_sha,
        head_sha=commits[0]["sha"] if commits else current_sha,
        commits=[PendingCommit(**c) for c in commits],
    )
