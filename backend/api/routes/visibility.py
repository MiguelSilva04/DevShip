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
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project
from backend.bd.models.user import User

router = APIRouter(tags=["visibility"])


def _get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return p


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

    latest_by_ae = {
        v.application_environment_id: v
        for v in _latest_versions_subquery(db, ae_ids).all()
    }

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
    ae = db.get(ApplicationEnvironment, ae_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")

    latest = _latest_versions_subquery(db, [ae_id]).first()

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
    ae = db.get(ApplicationEnvironment, ae_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")

    return (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.application_environment_id == ae_id)
        .order_by(desc(DeploymentVersion.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


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
