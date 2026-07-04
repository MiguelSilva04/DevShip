import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

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
    PodListResponse,
    PodStatus,
    UpToDateResponse,
    UpToDateStatus,
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.deployment_event import DeploymentEvent
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project
from backend.bd.models.user import User
from backend.services.cluster_validation import get_cluster_token
from backend.services.deploy_pipeline import compute_lifecycle_status
from backend.services.eks_discovery import EKSClusterInfo
from backend.services.gitops_scanner import resolve_branch_head
from backend.services.kubernetes_reader import (
    get_pod_logs,
    list_events_in_namespace,
    list_pods_in_namespace,
    pod_health_snapshot,
    pod_metrics,
)

router = APIRouter(tags=["visibility"])

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


def _get_ae_or_404(db: Session, ae_id: uuid.UUID) -> ApplicationEnvironment:
    ae = db.get(ApplicationEnvironment, ae_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")
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
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Falha ao ligar ao cluster: {e}")
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
    _get_project_or_404(db, project_id)
    return (
        db.query(Environment)
        .filter(Environment.project_id == project_id)
        .order_by(Environment.deployment_order)
        .all()
    )


# ---------------------------------------------------------------------------
# GET /projects/{id}/applications
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/applications", response_model=list[ApplicationListItem])
def list_applications(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    return (
        db.query(Application)
        .filter(Application.project_id == project_id, Application.is_archived.is_(False))
        .order_by(Application.name)
        .all()
    )


# ---------------------------------------------------------------------------
# GET /applications/{id}
# ---------------------------------------------------------------------------

@router.get("/applications/{app_id}", response_model=ApplicationDetailResponse)
def get_application(
    app_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

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
    ae = _get_ae_or_404(db, ae_id)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    if latest is not None:
        _refresh_lifecycle_from_events(db, [latest])

    return ApplicationEnvironmentDetail(
        id=ae.id,
        application_id=ae.application_id,
        environment_id=ae.environment_id,
        deployment_name=ae.deployment_name,
        enabled=ae.enabled,
        current_version=DeploymentVersionDetail.model_validate(latest) if latest else None,
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
    _get_ae_or_404(db, ae_id)

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
    ae = _get_ae_or_404(db, ae_id)

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
                any_ready, fatal_pods = pod_health_snapshot(eks_info, namespace)
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
        enabled=ae.enabled,
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
    ae = _get_ae_or_404(db, ae_id)
    eks_info, namespace = _resolve_cluster_and_namespace(db, ae)

    pod_list = list_pods_in_namespace(eks_info, namespace)

    metrics_available = True
    try:
        metrics = pod_metrics(eks_info, namespace)
    except Exception:
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
# GET /application-environments/{id}/events — live K8s read
# ---------------------------------------------------------------------------

@router.get("/application-environments/{ae_id}/events", response_model=list[K8sEvent])
def get_events(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id)
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
    ae = _get_ae_or_404(db, ae_id)
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
    _get_project_or_404(db, project_id)

    # All app_envs for this project (join through app or env)
    app_env_ids: list[uuid.UUID] = [
        row[0]
        for row in db.query(ApplicationEnvironment.id)
        .join(Application, ApplicationEnvironment.application_id == Application.id)
        .filter(Application.project_id == project_id, Application.is_archived.is_(False))
        .all()
    ]

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
        .filter(Application.project_id == project_id, Application.is_archived.is_(False))
        .order_by(Application.name)
        .all()
    )

    latest_by_ae = (
        {v.application_environment_id: v for v in _latest_versions_subquery(db, app_env_ids).all()}
        if app_env_ids else {}
    )

    all_ae = (
        db.query(ApplicationEnvironment)
        .filter(ApplicationEnvironment.application_id.in_([a.id for a in apps]))
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

    applications = [
        ApplicationWithStatus(
            id=app.id,
            name=app.name,
            environments=[
                ApplicationEnvironmentStatus(
                    id=ae.id,
                    environment_name=env_names.get(ae.environment_id, ""),
                    lifecycle_status=latest_by_ae[ae.id].lifecycle_status if ae.id in latest_by_ae else None,
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

def compute_up_to_date(argocd_sync_revision: str | None, gitops_head_sha: str | None) -> UpToDateStatus:
    """Pure: three-state comparison. A missing input on either side means we can't
    know — never collapse that into Outdated, that would read as a false alarm."""
    if argocd_sync_revision is None or gitops_head_sha is None:
        return UpToDateStatus.UNKNOWN
    return UpToDateStatus.UP_TO_DATE if argocd_sync_revision == gitops_head_sha else UpToDateStatus.OUTDATED


@router.get("/application-environments/{ae_id}/up-to-date", response_model=UpToDateResponse)
def get_up_to_date(
    ae_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ae = _get_ae_or_404(db, ae_id)

    latest = _latest_versions_subquery(db, [ae_id]).first()
    if latest is None or latest.argocd_sync_revision is None:
        return UpToDateResponse(status=UpToDateStatus.UNKNOWN, reason="Sem argocd_sync_revision para esta versão")

    env = db.get(Environment, ae.environment_id)
    project = db.get(Project, env.project_id)
    if not project.git_ops_repository_url or not env.gitops_branch:
        return UpToDateResponse(status=UpToDateStatus.UNKNOWN, reason="GitOps branch ou repositório não configurados")

    head_sha = resolve_branch_head(project.git_ops_repository_url, env.gitops_branch)
    if head_sha is None:
        return UpToDateResponse(
            status=UpToDateStatus.UNKNOWN,
            argocd_sync_revision=latest.argocd_sync_revision,
            reason="Não foi possível resolver o HEAD da branch GitOps via GitHub",
        )

    return UpToDateResponse(
        status=compute_up_to_date(latest.argocd_sync_revision, head_sha),
        gitops_head_sha=head_sha,
        argocd_sync_revision=latest.argocd_sync_revision,
    )
