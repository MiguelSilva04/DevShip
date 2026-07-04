import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.api.schemas.deploy import (
    DeploymentEventResponse,
    DeploymentRequestResponse,
    DeploymentRequestWithEvents,
    DeployRequest,
    RejectRequest,
    RollbackRequest,
)
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.deployment_event import DeploymentEvent
from backend.bd.models.deployment_request import DeploymentRequest, DeploymentType, RequestStatus
from backend.bd.models.deployment_version import DeploymentVersion
from backend.bd.models.environment import Environment
from backend.bd.models.team_member import TeamMember
from backend.bd.models.user import User
from backend.services import deploy_pipeline as dp

router = APIRouter(tags=["deploy"])


def _get_app_env_or_404(db: Session, app_env_id: uuid.UUID) -> ApplicationEnvironment:
    ae = db.get(ApplicationEnvironment, app_env_id)
    if ae is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ApplicationEnvironment not found")
    return ae


def _get_request_or_404(db: Session, request_id: uuid.UUID) -> DeploymentRequest:
    req = db.get(DeploymentRequest, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DeploymentRequest not found")
    return req


def _require_team_member(db: Session, app_env_id: uuid.UUID, user: User) -> tuple[ApplicationEnvironment, Environment, Application]:
    ae = _get_app_env_or_404(db, app_env_id)
    env = db.get(Environment, ae.environment_id)
    app = db.get(Application, ae.application_id)

    from backend.bd.models.project import Project
    project = db.get(Project, env.project_id)
    member = db.query(TeamMember).filter(
        TeamMember.team_id == project.team_id,
        TeamMember.user_id == user.id,
    ).first()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    return ae, env, app


def _require_approver(db: Session, req: DeploymentRequest, user: User) -> None:
    """Check user has the approval_required_role for this request's environment."""
    ae = db.get(ApplicationEnvironment, req.application_environment_id)
    env = db.get(Environment, ae.environment_id)
    from backend.bd.models.project import Project
    project = db.get(Project, env.project_id)
    member = db.query(TeamMember).filter(
        TeamMember.team_id == project.team_id,
        TeamMember.user_id == user.id,
    ).first()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    if env.requires_approval and env.approval_required_role is not None:
        if member.role != env.approval_required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Approval requires role {env.approval_required_role.value}",
            )


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/deploy
# ---------------------------------------------------------------------------

@router.post(
    "/application-environments/{app_env_id}/deploy",
    response_model=DeploymentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_deploy(
    app_env_id: uuid.UUID,
    body: DeployRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, env, app = _require_team_member(db, app_env_id, current_user)

    req = DeploymentRequest(
        application_environment_id=app_env_id,
        requested_by=current_user.id,
        deployment_type=DeploymentType.STANDARD,
        justification=body.justification,
    )
    db.add(req)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A deploy is already in progress for this ApplicationEnvironment",
        )

    if not env.requires_approval:
        try:
            dp.trigger_deploy(db, req, env, app)
        except Exception as e:
            req.status = RequestStatus.FAILED
            req.failure_reason = str(e)
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        background_tasks.add_task(dp.observe_deployment, req.id)
    else:
        db.commit()

    db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/rollback
# ---------------------------------------------------------------------------

@router.post(
    "/application-environments/{app_env_id}/rollback",
    response_model=DeploymentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rollback(
    app_env_id: uuid.UUID,
    body: RollbackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, env, app = _require_team_member(db, app_env_id, current_user)

    target = db.get(DeploymentVersion, body.deployment_version_id)
    if target is None or target.application_environment_id != app_env_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DeploymentVersion not found for this ApplicationEnvironment")
    if not target.image_tag:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Target version has no image_tag — nothing to roll back to")

    current = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.application_environment_id == app_env_id)
        .order_by(DeploymentVersion.created_at.desc())
        .first()
    )
    if current is not None and current.id == target.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Target version is already the current version")

    req = DeploymentRequest(
        application_environment_id=app_env_id,
        requested_by=current_user.id,
        deployment_type=DeploymentType.ROLLBACK,
        rollback_target_version_id=target.id,
        justification=body.justification,
    )
    db.add(req)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A deploy is already in progress for this ApplicationEnvironment",
        )

    if not env.requires_approval:
        try:
            dp.trigger_deploy(db, req, env, app)
        except Exception as e:
            req.status = RequestStatus.FAILED
            req.failure_reason = str(e)
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        background_tasks.add_task(dp.observe_deployment, req.id)
    else:
        db.commit()

    db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# GET /deployment-requests
# ---------------------------------------------------------------------------

@router.get("/deployment-requests", response_model=list[DeploymentRequestResponse])
def list_deploy_requests(
    request_status: RequestStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(DeploymentRequest)
    if request_status is not None:
        q = q.filter(DeploymentRequest.status == request_status)
    return q.order_by(DeploymentRequest.requested_at.desc()).all()


# ---------------------------------------------------------------------------
# GET /deployment-requests/{id}
# ---------------------------------------------------------------------------

@router.get("/deployment-requests/{request_id}", response_model=DeploymentRequestResponse)
def get_deploy_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_request_or_404(db, request_id)


# ---------------------------------------------------------------------------
# POST /deployment-requests/{id}/approve
# ---------------------------------------------------------------------------

@router.post("/deployment-requests/{request_id}/approve", response_model=DeploymentRequestResponse)
def approve_deploy(
    request_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404(db, request_id)
    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is {req.status.value}, not PENDING")

    _require_approver(db, req, current_user)

    ae = db.get(ApplicationEnvironment, req.application_environment_id)
    env = db.get(Environment, ae.environment_id)
    app = db.get(Application, ae.application_id)

    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)
    req.status = RequestStatus.APPROVED
    db.commit()

    try:
        dp.trigger_deploy(db, req, env, app)
    except Exception as e:
        req.status = RequestStatus.FAILED
        req.failure_reason = str(e)
        req.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    background_tasks.add_task(dp.observe_deployment, req.id)
    db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# POST /deployment-requests/{id}/reject
# ---------------------------------------------------------------------------

@router.post("/deployment-requests/{request_id}/reject", response_model=DeploymentRequestResponse)
def reject_deploy(
    request_id: uuid.UUID,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404(db, request_id)
    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is {req.status.value}, not PENDING")

    _require_approver(db, req, current_user)

    req.status = RequestStatus.REJECTED
    req.justification = body.justification
    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)
    req.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# GET /deployment-requests/{id}/events
# ---------------------------------------------------------------------------

@router.get("/deployment-requests/{request_id}/events", response_model=DeploymentRequestWithEvents)
def get_deploy_events(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404(db, request_id)

    version = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.deployment_request_id == request_id)
        .first()
    )

    if version is None:
        events = []
    else:
        events = (
            db.query(DeploymentEvent)
            .filter(DeploymentEvent.deployment_version_id == version.id)
            .order_by(DeploymentEvent.event_timestamp)
            .all()
        )

    return DeploymentRequestWithEvents(
        request=DeploymentRequestResponse.model_validate(req),
        events=[DeploymentEventResponse.model_validate(e) for e in events],
    )
