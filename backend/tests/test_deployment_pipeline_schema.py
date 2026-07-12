import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from backend.bd.models import (
    Application,
    ApplicationEnvironment,
    Company,
    DeploymentEvent,
    DeploymentEventType,
    DeploymentRequest,
    DeploymentType,
    DeploymentVersion,
    Environment,
    EventSource,
    LifecycleStatus,
    Project,
    RequestStatus,
    Severity,
    Team,
    TriggerSource,
    User,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email: str = None) -> User:
    return User(
        name="Test User",
        email=email or f"{uuid.uuid4()}@example.com",
        password_hash="hashed",
    )


def make_company() -> Company:
    return Company(name=f"{uuid.uuid4()}.test", domain=f"{uuid.uuid4()}.test")


def make_team(company: Company) -> Team:
    return Team(name="Test Team", company_id=company.id)


def make_project(team: Team) -> Project:
    return Project(team_id=team.id, name="Test Project")


def make_environment(project: Project) -> Environment:
    return Environment(project_id=project.id, name="dev", deployment_order=0)


def make_application(project: Project) -> Application:
    return Application(
        project_id=project.id,
        name="Test App",
        source_repository="github.com/org/repo",
        ci_workflow_file="deploy.yml",
    )


def make_app_env(app: Application, env: Environment) -> ApplicationEnvironment:
    return ApplicationEnvironment(
        application_id=app.id,
        environment_id=env.id,
        deployment_name="test-deployment",
    )


def make_request(
    app_env: ApplicationEnvironment,
    requested_by: User | None = None,
    deployment_type: DeploymentType = DeploymentType.STANDARD,
    status: RequestStatus = RequestStatus.PENDING,
    justification: str | None = None,
) -> DeploymentRequest:
    return DeploymentRequest(
        application_environment_id=app_env.id,
        requested_by=requested_by.id if requested_by else None,
        deployment_type=deployment_type,
        status=status,
        justification=justification,
    )


def make_version(
    app_env: ApplicationEnvironment,
    request: DeploymentRequest | None = None,
    trigger_source: TriggerSource = TriggerSource.DEVSHIP,
) -> DeploymentVersion:
    return DeploymentVersion(
        application_environment_id=app_env.id,
        deployment_request_id=request.id if request else None,
        trigger_source=trigger_source,
    )


def make_event(version: DeploymentVersion) -> DeploymentEvent:
    return DeploymentEvent(
        deployment_version_id=version.id,
        event_type=DeploymentEventType.WORKFLOW_STARTED,
        source=EventSource.GITHUB,
        severity=Severity.INFO,
        event_timestamp=datetime.now(timezone.utc),
    )


def setup_chain(db_session):
    """Return (user, app_env) after flushing a minimal chain to the DB."""
    user = make_user()
    company = make_company()
    db_session.add_all([user, company])
    db_session.flush()
    team = make_team(company)
    db_session.add(team)
    db_session.flush()

    project = make_project(team)
    db_session.add(project)
    db_session.flush()

    env = make_environment(project)
    app = make_application(project)
    db_session.add_all([env, app])
    db_session.flush()

    app_env = make_app_env(app, env)
    db_session.add(app_env)
    db_session.flush()

    return user, app_env


# ---------------------------------------------------------------------------
# DeploymentRequest — basic creation
# ---------------------------------------------------------------------------

def test_create_request_defaults(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(app_env)
    db_session.add(req)
    db_session.flush()

    db_session.expire(req)
    db_session.refresh(req)
    assert req.id is not None
    assert req.status == RequestStatus.PENDING
    assert req.requested_at is not None
    assert req.created_at is not None
    assert req.requested_by is None
    assert req.approved_by is None
    assert req.justification is None
    assert req.github_workflow_run_id is None


def _fresh_app_env(db_session, project):
    """Create a new (env, app, app_env) chain and return the app_env."""
    from backend.bd.models.environment import Environment
    env = Environment(project_id=project.id, name=f"e-{uuid.uuid4().hex[:6]}", deployment_order=0)
    from backend.bd.models.application import Application
    app = Application(
        project_id=project.id,
        name=f"a-{uuid.uuid4().hex[:6]}",
        source_repository=f"github.com/org/{uuid.uuid4().hex[:6]}",
        ci_workflow_file="deploy.yml",
    )
    db_session.add_all([env, app])
    db_session.flush()
    from backend.bd.models.application_environment import ApplicationEnvironment
    ae = ApplicationEnvironment(application_id=app.id, environment_id=env.id, deployment_name="d")
    db_session.add(ae)
    db_session.flush()
    return ae


def test_request_all_statuses(db_session):
    # The partial UNIQUE index only allows one in-flight (PENDING/APPROVED/RUNNING) request
    # per app_env at a time — use a fresh app_env per status to avoid collision.
    _, first_app_env = setup_chain(db_session)
    env = db_session.get(__import__('backend.bd.models.environment', fromlist=['Environment']).Environment,
                         first_app_env.environment_id)
    from backend.bd.models.project import Project
    project = db_session.get(Project, env.project_id)

    for s in RequestStatus:
        justification = "reason" if s == RequestStatus.REJECTED else None
        ae = _fresh_app_env(db_session, project)
        r = DeploymentRequest(
            application_environment_id=ae.id,
            deployment_type=DeploymentType.STANDARD,
            status=s,
            justification=justification,
        )
        db_session.add(r)
        db_session.flush()


def test_request_all_deployment_types(db_session):
    _, first_app_env = setup_chain(db_session)
    env = db_session.get(__import__('backend.bd.models.environment', fromlist=['Environment']).Environment,
                         first_app_env.environment_id)
    from backend.bd.models.project import Project
    project = db_session.get(Project, env.project_id)

    for dt in DeploymentType:
        ae = _fresh_app_env(db_session, project)
        r = DeploymentRequest(application_environment_id=ae.id, deployment_type=dt)
        db_session.add(r)
        db_session.flush()


# ---------------------------------------------------------------------------
# CHECK constraint — justification required on rejection
# ---------------------------------------------------------------------------

def test_rejected_without_justification_raises(db_session):
    _, app_env = setup_chain(db_session)

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            req = make_request(app_env, status=RequestStatus.REJECTED, justification=None)
            db_session.add(req)
            db_session.flush()


def test_rejected_with_justification_succeeds(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(
        app_env,
        status=RequestStatus.REJECTED,
        justification="Deployment freeze in effect.",
    )
    db_session.add(req)
    db_session.flush()

    assert req.id is not None
    assert req.justification == "Deployment freeze in effect."


def test_non_rejected_without_justification_allowed(db_session):
    _, first_app_env = setup_chain(db_session)
    env = db_session.get(__import__('backend.bd.models.environment', fromlist=['Environment']).Environment,
                         first_app_env.environment_id)
    from backend.bd.models.project import Project
    project = db_session.get(Project, env.project_id)

    for s in (RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.RUNNING,
              RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.CANCELLED):
        ae = _fresh_app_env(db_session, project)
        r = DeploymentRequest(
            application_environment_id=ae.id,
            deployment_type=DeploymentType.STANDARD,
            status=s,
            justification=None,
        )
        db_session.add(r)
        db_session.flush()


# ---------------------------------------------------------------------------
# DeploymentVersion — basic creation
# ---------------------------------------------------------------------------

def test_create_version_defaults(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    db_session.expire(version)
    db_session.refresh(version)
    assert version.id is not None
    assert version.lifecycle_status == LifecycleStatus.DEPLOYING
    assert version.trigger_source == TriggerSource.DEVSHIP
    assert version.deployment_request_id is None
    assert version.created_at is not None


def test_version_with_all_fields(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(app_env)
    db_session.add(req)
    db_session.flush()

    version = DeploymentVersion(
        application_environment_id=app_env.id,
        deployment_request_id=req.id,
        image_tag="v1.2.3",
        source_commit_sha="b" * 40,
        argocd_sync_revision="rev-123",
        lifecycle_status=LifecycleStatus.HEALTHY,
        trigger_source=TriggerSource.DEVSHIP,
    )
    db_session.add(version)
    db_session.flush()

    assert version.id is not None


def test_version_all_lifecycle_statuses(db_session):
    _, app_env = setup_chain(db_session)

    for s in LifecycleStatus:
        v = DeploymentVersion(
            application_environment_id=app_env.id,
            lifecycle_status=s,
        )
        db_session.add(v)
    db_session.flush()


# ---------------------------------------------------------------------------
# DeploymentVersion — nullable UNIQUE on deployment_request_id
# ---------------------------------------------------------------------------

def test_two_versions_without_request_allowed(db_session):
    _, app_env = setup_chain(db_session)

    v1 = make_version(app_env, trigger_source=TriggerSource.EXTERNAL)
    v2 = make_version(app_env, trigger_source=TriggerSource.EXTERNAL)
    db_session.add_all([v1, v2])
    db_session.flush()

    assert v1.id != v2.id


def test_two_versions_same_request_raises(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(app_env)
    db_session.add(req)
    db_session.flush()

    v1 = make_version(app_env, request=req)
    db_session.add(v1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            v2 = make_version(app_env, request=req)
            db_session.add(v2)
            db_session.flush()


# ---------------------------------------------------------------------------
# DeploymentEvent
# ---------------------------------------------------------------------------

def test_create_event(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    event = make_event(version)
    db_session.add(event)
    db_session.flush()

    assert event.id is not None
    assert event.event_type == DeploymentEventType.WORKFLOW_STARTED
    assert event.source == EventSource.GITHUB
    assert event.severity == Severity.INFO
    assert event.created_at is not None


def test_all_14_event_types(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    for et in DeploymentEventType:
        ev = DeploymentEvent(
            deployment_version_id=version.id,
            event_type=et,
            source=EventSource.KUBERNETES,
            severity=Severity.INFO,
            event_timestamp=datetime.now(timezone.utc),
        )
        db_session.add(ev)
    db_session.flush()

    assert len(list(DeploymentEventType)) == 14


def test_invalid_event_type_raises(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    with pytest.raises((DataError, Exception)):
        with db_session.begin_nested():
            db_session.execute(
                text(
                    "INSERT INTO deployment_events"
                    " (id, deployment_version_id, event_type, source, severity, event_timestamp, created_at)"
                    " VALUES (:id, :vid, 'INVALID_EVENT', 'GITHUB', 'INFO', NOW(), NOW())"
                ),
                {"id": str(uuid.uuid4()), "vid": str(version.id)},
            )


def test_invalid_severity_raises(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    with pytest.raises((DataError, Exception)):
        with db_session.begin_nested():
            db_session.execute(
                text(
                    "INSERT INTO deployment_events"
                    " (id, deployment_version_id, event_type, source, severity, event_timestamp, created_at)"
                    " VALUES (:id, :vid, 'WORKFLOW_STARTED', 'GITHUB', 'CRITICAL', NOW(), NOW())"
                ),
                {"id": str(uuid.uuid4()), "vid": str(version.id)},
            )


# ---------------------------------------------------------------------------
# ON DELETE — CASCADE
# ---------------------------------------------------------------------------

def test_delete_app_env_cascades_requests(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(app_env)
    db_session.add(req)
    db_session.flush()
    req_id = req.id

    db_session.delete(app_env)
    db_session.flush()

    db_session.expunge(req)
    assert db_session.get(DeploymentRequest, req_id) is None


def test_delete_app_env_cascades_versions(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()
    ver_id = version.id

    db_session.delete(app_env)
    db_session.flush()

    db_session.expunge(version)
    assert db_session.get(DeploymentVersion, ver_id) is None


def test_delete_version_cascades_events(db_session):
    _, app_env = setup_chain(db_session)

    version = make_version(app_env)
    db_session.add(version)
    db_session.flush()

    event = make_event(version)
    db_session.add(event)
    db_session.flush()
    event_id = event.id

    db_session.delete(version)
    db_session.flush()

    db_session.expunge(event)
    assert db_session.get(DeploymentEvent, event_id) is None


# ---------------------------------------------------------------------------
# ON DELETE — SET NULL
# ---------------------------------------------------------------------------

def test_delete_user_sets_requested_by_null(db_session):
    user, app_env = setup_chain(db_session)

    req = make_request(app_env, requested_by=user)
    db_session.add(req)
    db_session.flush()
    assert req.requested_by == user.id

    db_session.delete(user)
    db_session.flush()

    db_session.expire(req)
    db_session.refresh(req)
    assert req.requested_by is None


def test_delete_user_sets_approved_by_null(db_session):
    user, app_env = setup_chain(db_session)
    approver = make_user()
    db_session.add(approver)
    db_session.flush()

    req = DeploymentRequest(
        application_environment_id=app_env.id,
        deployment_type=DeploymentType.STANDARD,
        approved_by=approver.id,
        status=RequestStatus.APPROVED,
    )
    db_session.add(req)
    db_session.flush()
    assert req.approved_by == approver.id

    db_session.delete(approver)
    db_session.flush()

    db_session.expire(req)
    db_session.refresh(req)
    assert req.approved_by is None


def test_delete_request_sets_version_request_id_null(db_session):
    _, app_env = setup_chain(db_session)

    req = make_request(app_env)
    db_session.add(req)
    db_session.flush()

    version = make_version(app_env, request=req)
    db_session.add(version)
    db_session.flush()
    assert version.deployment_request_id == req.id

    db_session.delete(req)
    db_session.flush()

    db_session.expire(version)
    db_session.refresh(version)
    assert version.deployment_request_id is None
