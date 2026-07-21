import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.authorization import _require_application_access
from backend.api.deps import get_current_user, get_db
from backend.api.rate_limit import limiter
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
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.deployment_event import DeploymentEvent
from backend.bd.models.deployment_request import DeploymentRequest, DeploymentType, RequestStatus
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User
from backend.services import deploy_pipeline as dp
from backend.services.cluster_validation import validate_cluster
from backend.services.gitops_scanner import get_branch_head_commit, is_repo_collaborator

router = APIRouter(tags=["deploy"])
logger = logging.getLogger(__name__)

# trigger_deploy talks straight to the GitHub API — a raw str(e) from that (requests
# HTTPError, connection errors, ...) can carry the full GitHub API URL, owner/repo names,
# rate-limit details. Same class of leak already fixed for AWS/boto3 in cluster_validation.py;
# this is the GitHub-specific equivalent. Full exception goes to the log only.
_DISPATCH_FAILED_MESSAGE = "Não foi possível disparar o deploy. Verifica a configuração do workflow e tenta novamente."


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


def _get_request_or_404_checked(db: Session, request_id: uuid.UUID, user: User) -> DeploymentRequest:
    """Same as _get_request_or_404 plus the team/Application access check — for the
    read-only GET routes, which had no authorization check at all."""
    req = _get_request_or_404(db, request_id)
    ae = db.get(ApplicationEnvironment, req.application_environment_id)
    _require_application_access(db, ae.application_id, user)
    return req


def _to_response(db: Session, req: DeploymentRequest) -> DeploymentRequestResponse:
    """requested_by_email/approved_by_email aren't columns on DeploymentRequest — the
    approver needs to see who's asking (and who signed off) without a separate lookup,
    same reasoning as DeploymentVersionDetail.requested_by_email in visibility.py."""
    resp = DeploymentRequestResponse.model_validate(req)
    if req.requested_by is not None:
        requester = db.get(User, req.requested_by)
        if requester is not None:
            resp.requested_by_email = requester.email
    if req.approved_by is not None:
        approver = db.get(User, req.approved_by)
        if approver is not None:
            resp.approved_by_email = approver.email
    return resp


_STATUS_LABEL_PT = {
    RequestStatus.PENDING: "pendente",
    RequestStatus.APPROVED: "aprovado",
    RequestStatus.REJECTED: "rejeitado",
    RequestStatus.RUNNING: "em execução",
    RequestStatus.SUCCESS: "concluído",
    RequestStatus.FAILED: "falhado",
    RequestStatus.CANCELLED: "cancelado",
}

# Job titles, not translated — matches ROLE_LABEL in frontend/src/pages/app/Environments.tsx
_ROLE_LABEL_PT = {
    TeamMemberRole.DEVELOPER: "Developer",
    TeamMemberRole.TECH_LEAD: "Tech Lead",
    TeamMemberRole.CLOUD_ENGINEER: "Cloud Engineer",
}


def _already_decided_message(current_status: RequestStatus) -> str:
    """approve/reject only act on PENDING — a second click after someone else (or the same
    person, from a stale tab) already decided must read as "this was already resolved",
    not leak the raw enum value to the user."""
    return f"Este pedido já não está pendente — o estado atual é {_STATUS_LABEL_PT[current_status]}."


def _require_team_member(db: Session, app_env_id: uuid.UUID, user: User) -> tuple[ApplicationEnvironment, Environment, Application]:
    ae = _get_app_env_or_404(db, app_env_id)
    env = db.get(Environment, ae.environment_id)
    app = db.get(Application, ae.application_id)

    _require_application_access(db, ae.application_id, user)
    return ae, env, app


def _require_cluster_reachable(db: Session, env: Environment) -> None:
    """Checked before dispatching anything to GitHub Actions — without this, a deploy with
    an unreachable cluster still burns a real CI build (and its minutes/cost) only to fail
    later at the K8s phase in observe_deployment(), when the outcome was already knowable
    upfront. If there's no ClusterContext at all, that's a valid setup (CI-only pipeline,
    same case observe_deployment() already treats as success-after-CI) — only an existing,
    unreachable cluster blocks here."""
    cluster_ctx = db.query(ClusterContext).filter(ClusterContext.project_id == env.project_id).first()
    if cluster_ctx is None:
        return
    try:
        validate_cluster(
            cluster_arn=cluster_ctx.cluster_arn,
            iam_role_arn=cluster_ctx.iam_role_arn,
            external_id=cluster_ctx.external_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


def _check_github_gate(app: Application, environment: Environment, user: User, check_authorship: bool) -> str | None:
    """Devolve None (passa), uma mensagem de aviso (não bloqueia), ou levanta HTTPException 403 (bloqueia)."""
    if not user.github_username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Configura a tua identidade GitHub antes de continuar.")
    if not is_repo_collaborator(app.source_repository, user.github_username):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não pertences a esta application.")
    if not check_authorship:
        return None
    head = get_branch_head_commit(app.source_repository, environment.source_branch or "main")
    if head is None or head["author_email"] != user.github_email:
        return "Este commit não é teu — tens a certeza que queres continuar?"
    return None


# Hierarquia de roles da Team, do mais baixo ao mais alto — usada só para decidir se uma
# role "cobre" a que é exigida numa aprovação (ex: approval_required_role=TECH_LEAD deixa
# um CLOUD_ENGINEER aprovar também, nunca o contrário). Não usar isto para autorização de
# acesso a nível de Application — aí a comparação continua a ser de igualdade exata.
_ROLE_RANK = {TeamMemberRole.DEVELOPER: 0, TeamMemberRole.TECH_LEAD: 1, TeamMemberRole.CLOUD_ENGINEER: 2}


def _require_approver(db: Session, req: DeploymentRequest, user: User) -> None:
    """Check user has the approval_required_role for this request's environment, and —
    same as every other Application-scoped route — that a DEVELOPER approver also holds
    an ApplicationTeamMember grant for it. Without this, a Tech Lead with no grant on the
    Application could still approve/reject its deploys off team membership alone."""
    ae = db.get(ApplicationEnvironment, req.application_environment_id)
    env = db.get(Environment, ae.environment_id)
    member = _require_application_access(db, ae.application_id, user)

    # A rollback targeting a RolledBack version (create_rollback forces approval for these,
    # regardless of the environment's own setting) always needs a TECH_LEAD or CLOUD_ENGINEER —
    # this overrides env.approval_required_role, which may not even be configured.
    if req.deployment_type == DeploymentType.ROLLBACK and req.rollback_target_version_id:
        target = db.get(DeploymentVersion, req.rollback_target_version_id)
        if target is not None and target.lifecycle_status == LifecycleStatus.ROLLED_BACK:
            if member.role not in (TeamMemberRole.TECH_LEAD, TeamMemberRole.CLOUD_ENGINEER):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Rollback para uma versão previamente abandonada requer aprovação de Tech Lead ou Cloud Engineer",
                )
            return

    # approval_required_role é um patamar mínimo, não uma role exata — uma role acima na
    # hierarquia (ex: CLOUD_ENGINEER quando é exigido TECH_LEAD) cobre-a sempre, porque quem
    # está acima já podia fazer tudo o que a role exigida faz. O inverso não vale: uma role
    # abaixo não aprova, mesmo que o pedido pareça "menos crítico" à primeira vista.
    if env.requires_approval and env.approval_required_role is not None:
        if _ROLE_RANK[member.role] < _ROLE_RANK[env.approval_required_role]:
            role_label = _ROLE_LABEL_PT.get(env.approval_required_role, env.approval_required_role.value)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Este pedido só pode ser aprovado por um {role_label}.",
            )


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/deploy
# ---------------------------------------------------------------------------

@router.post(
    "/application-environments/{app_env_id}/deploy",
    response_model=DeploymentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def create_deploy(
    request: Request,
    app_env_id: uuid.UUID,
    body: DeployRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, env, app = _require_team_member(db, app_env_id, current_user)
    warning = _check_github_gate(app, env, current_user, check_authorship=not body.confirmed)
    _require_cluster_reachable(db, env)

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
            detail="Já existe um deploy em curso para este ambiente.",
        )

    if not env.requires_approval:
        try:
            dp.trigger_deploy(db, req, env, app)
        except Exception:
            logger.exception("trigger_deploy failed for request %s", req.id)
            req.status = RequestStatus.FAILED
            req.failure_reason = _DISPATCH_FAILED_MESSAGE
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=_DISPATCH_FAILED_MESSAGE)
        background_tasks.add_task(dp.observe_deployment, req.id)
    else:
        db.commit()

    db.refresh(req)
    response = _to_response(db, req)
    response.warning = warning
    return response


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/rollback
# ---------------------------------------------------------------------------

@router.post(
    "/application-environments/{app_env_id}/rollback",
    response_model=DeploymentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def create_rollback(
    request: Request,
    app_env_id: uuid.UUID,
    body: RollbackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, env, app = _require_team_member(db, app_env_id, current_user)
    _check_github_gate(app, env, current_user, check_authorship=False)
    _require_cluster_reachable(db, env)

    current = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.application_environment_id == app_env_id)
        .order_by(DeploymentVersion.created_at.desc())
        .first()
    )

    # No manual target selection — rollback always targets the last version that was
    # healthy, excluding the current one (design doc rule, not the mockup's per-version
    # picker). Superseded means "was Healthy, later replaced" (see _supersede_previous_version
    # in deploy_pipeline.py) — it must count here too, or every AE loses its rollback target
    # the moment a second successful deploy lands, since only one version can be Healthy at a time.
    # RolledBack also counts: a version abandoned via rollback was Healthy right before that —
    # without this, navigating v3→v4→v3 permanently locks v4 out as a future target, and the
    # only way back is through progressively older Superseded versions.
    target = (
        db.query(DeploymentVersion)
        .filter(
            DeploymentVersion.application_environment_id == app_env_id,
            DeploymentVersion.lifecycle_status.in_([
                LifecycleStatus.HEALTHY, LifecycleStatus.SUPERSEDED, LifecycleStatus.ROLLED_BACK,
            ]),
            DeploymentVersion.id != (current.id if current else None),
        )
        .order_by(DeploymentVersion.created_at.desc())
        .first()
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No previous healthy version to roll back to")
    if not target.image_tag:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Target version has no image_tag — nothing to roll back to")

    # A RolledBack target doesn't carry the same guarantee as Superseded — Superseded means
    # every automated signal said it was fine; RolledBack can mean a person walked away from
    # it for a reason Kubernetes never reports as a failure (a business bug, not a crash).
    # So: justification becomes mandatory, and approval is always required regardless of the
    # environment's own requires_approval setting.
    targeting_rolled_back = target.lifecycle_status == LifecycleStatus.ROLLED_BACK
    if targeting_rolled_back and not body.justification:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Justificação obrigatória — esta versão foi previamente abandonada via rollback.",
        )

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
            detail="Já existe um deploy em curso para este ambiente.",
        )

    # Targeting a RolledBack version always forces approval, even for environments that
    # normally skip it — _require_approver enforces the TECH_LEAD/CLOUD_ENGINEER-only rule.
    if not env.requires_approval and not targeting_rolled_back:
        try:
            dp.trigger_deploy(db, req, env, app)
        except Exception:
            logger.exception("trigger_deploy failed for request %s", req.id)
            req.status = RequestStatus.FAILED
            req.failure_reason = _DISPATCH_FAILED_MESSAGE
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=_DISPATCH_FAILED_MESSAGE)
        background_tasks.add_task(dp.observe_deployment, req.id)
    else:
        db.commit()

    db.refresh(req)
    return _to_response(db, req)


# ---------------------------------------------------------------------------
# GET /deployment-requests
# ---------------------------------------------------------------------------

@router.get("/deployment-requests", response_model=list[DeploymentRequestResponse])
def list_deploy_requests(
    request_status: RequestStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scoped to the requests the caller can actually see: Applications belonging to a
    Team they're a member of, filtered further to granted Applications for DEVELOPERs."""
    memberships = db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    if not memberships:
        return []

    accessible_app_ids: set[uuid.UUID] = set()
    for member in memberships:
        apps_q = (
            db.query(Application.id)
            .join(Project, Application.project_id == Project.id)
            .filter(Project.team_id == member.team_id)
        )
        if member.role == TeamMemberRole.DEVELOPER:
            apps_q = apps_q.join(
                ApplicationTeamMember, ApplicationTeamMember.application_id == Application.id
            ).filter(ApplicationTeamMember.team_member_id == member.id)
        accessible_app_ids.update(row[0] for row in apps_q.all())

    if not accessible_app_ids:
        return []

    q = (
        db.query(DeploymentRequest)
        .join(ApplicationEnvironment, DeploymentRequest.application_environment_id == ApplicationEnvironment.id)
        .filter(ApplicationEnvironment.application_id.in_(accessible_app_ids))
    )
    if request_status is not None:
        q = q.filter(DeploymentRequest.status == request_status)
    return [_to_response(db, req) for req in q.order_by(DeploymentRequest.requested_at.desc()).all()]


# ---------------------------------------------------------------------------
# GET /deployment-requests/{id}
# ---------------------------------------------------------------------------

@router.get("/deployment-requests/{request_id}", response_model=DeploymentRequestResponse)
def get_deploy_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404_checked(db, request_id, current_user)
    return _to_response(db, req)


# ---------------------------------------------------------------------------
# POST /deployment-requests/{id}/approve
# ---------------------------------------------------------------------------

@router.post("/deployment-requests/{request_id}/approve", response_model=DeploymentRequestResponse)
@limiter.limit("10/minute")
def approve_deploy(
    request: Request,
    request_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404(db, request_id)
    _require_approver(db, req, current_user)

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_already_decided_message(req.status))

    ae = db.get(ApplicationEnvironment, req.application_environment_id)
    env = db.get(Environment, ae.environment_id)
    app = db.get(Application, ae.application_id)
    _require_cluster_reachable(db, env)

    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)
    req.status = RequestStatus.APPROVED
    db.commit()

    try:
        dp.trigger_deploy(db, req, env, app)
    except Exception:
        logger.exception("trigger_deploy failed for request %s", req.id)
        req.status = RequestStatus.FAILED
        req.failure_reason = _DISPATCH_FAILED_MESSAGE
        req.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=_DISPATCH_FAILED_MESSAGE)

    background_tasks.add_task(dp.observe_deployment, req.id)
    db.refresh(req)
    return _to_response(db, req)


# ---------------------------------------------------------------------------
# POST /deployment-requests/{id}/reject
# ---------------------------------------------------------------------------

@router.post("/deployment-requests/{request_id}/reject", response_model=DeploymentRequestResponse)
@limiter.limit("10/minute")
def reject_deploy(
    request: Request,
    request_id: uuid.UUID,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404(db, request_id)
    _require_approver(db, req, current_user)

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_already_decided_message(req.status))

    req.status = RequestStatus.REJECTED
    req.justification = body.justification
    req.approved_by = current_user.id
    req.approved_at = datetime.now(timezone.utc)
    req.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _to_response(db, req)


# ---------------------------------------------------------------------------
# GET /deployment-requests/{id}/events
# ---------------------------------------------------------------------------

@router.get("/deployment-requests/{request_id}/events", response_model=DeploymentRequestWithEvents)
def get_deploy_events(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = _get_request_or_404_checked(db, request_id, current_user)

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
        request=_to_response(db, req),
        events=[DeploymentEventResponse.model_validate(e) for e in events],
    )
