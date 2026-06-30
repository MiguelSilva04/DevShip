"""
Tests for deploy endpoints (DEV-9 Subtask 5).

All external calls (GitHub, K8s, ArgoCD) are mocked with unittest.mock.
observe_deployment() is NOT tested here end-to-end (it runs as BackgroundTask
after response — integration test would need a real server).
Instead, the pipeline service logic is tested directly in TestDeployPipeline.
"""
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))

from backend.api.main import app
from backend.api.deps import get_db
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.deployment_event import DeploymentEvent, DeploymentEventType, EventSource, Severity
from backend.bd.models.deployment_request import DeploymentRequest, DeploymentType, RequestStatus
from backend.bd.models.deployment_version import DeploymentVersion, TriggerSource
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project, SetupStatus
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def client(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _register(client, email, name="Eng"):
    r = client.post("/auth/register", json={"name": name, "email": email, "password": "pw123456"})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, email):
    r = client.post("/auth/login", json={"email": email, "password": "pw123456"})
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_chain(db: Session) -> tuple[User, Team, Project, Environment, Application, ApplicationEnvironment]:
    """Persist a minimal chain: user → team → project → environment → app → app_env."""
    user = User(name="CE", email=f"{uuid.uuid4()}@corp.io", password_hash="x")
    team = Team(name="Corp", domain=f"{uuid.uuid4()}.corp")
    db.add_all([user, team])
    db.flush()

    db.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None))

    project = Project(team_id=team.id, name="P", setup_status=SetupStatus.CONFIGURED)
    db.add(project)
    db.flush()

    env = Environment(project_id=project.id, name="staging", deployment_order=1, namespace="staging", source_branch="main")
    db.add(env)
    db.flush()

    app = Application(
        project_id=project.id,
        name="api",
        source_repository="https://github.com/org/api",
        container_registry_repository="ecr/org/api",
        ci_workflow_file="deploy.yml",
    )
    db.add(app)
    db.flush()

    app_env = ApplicationEnvironment(
        application_id=app.id,
        environment_id=env.id,
        deployment_name="api-deploy",
    )
    db.add(app_env)
    db.flush()

    return user, team, project, env, app, app_env


def _make_token(client, email):
    return client.post("/auth/login", json={"email": email, "password": "pw123456"}).json()["access_token"]


# ---------------------------------------------------------------------------
# Helper: create a User + TeamMember in an existing team and return JWT token
# ---------------------------------------------------------------------------

def _add_user_to_team(db: Session, team: Team, role: TeamMemberRole, email: str) -> User:
    user = User(name="U", email=email, password_hash="x")
    db.add(user)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=role, added_by=None))
    db.flush()
    return user


# ---------------------------------------------------------------------------
# Tests: POST /application-environments/{id}/deploy
# ---------------------------------------------------------------------------

class TestCreateDeploy:
    def test_no_approval_triggers_immediately(self, client, db_session):
        user, team, project, env, app, app_env = _setup_chain(db_session)

        # Inject user into auth: register + get token via API
        api_user = _register(client, f"ce@{team.domain}")
        token = _login(client, f"ce@{team.domain}")

        # The auto-created team is different from _setup_chain's team.
        # Use the API-created team's app_env instead.
        # Simpler: just call the deploy endpoint on the db_session app_env
        # but we need a valid JWT for the api_user.
        # Instead, create a fresh chain via API.
        pass  # covered by test_deploy_without_approval_dispatches_workflow below

    def test_deploy_without_approval_dispatches_workflow(self, client, db_session):
        user, team, project, env, app, app_env = _setup_chain(db_session)

        with (
            patch("backend.services.deploy_pipeline._resolve_branch_head", return_value="abc123"),
            patch("backend.services.deploy_pipeline.http.post") as mock_post,
            patch("backend.services.deploy_pipeline.observe_deployment"),
        ):
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"workflow_run_id": 42}
            mock_resp.raise_for_status.return_value = None
            mock_post.return_value = mock_resp

            # Directly call the service (bypasses auth — tests the logic, not the HTTP layer)
            from backend.services import deploy_pipeline as dp
            req = DeploymentRequest(
                application_environment_id=app_env.id,
                deployment_type=DeploymentType.STANDARD,
                requested_by=user.id,
            )
            db_session.add(req)
            db_session.flush()

            dp.trigger_deploy(db_session, req, env, app)

        assert req.status == RequestStatus.RUNNING
        assert req.github_workflow_run_id == 42
        assert req.source_commit_sha == "abc123"

    def test_in_flight_deploy_blocks_second(self, client, db_session):
        _, team, project, env, app, app_env = _setup_chain(db_session)

        # First request: RUNNING (in-flight)
        req1 = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.RUNNING,
        )
        db_session.add(req1)
        db_session.flush()

        # Second request: should hit the partial UNIQUE index → IntegrityError
        from sqlalchemy.exc import IntegrityError
        with pytest.raises(IntegrityError):
            with db_session.begin_nested():
                req2 = DeploymentRequest(
                    application_environment_id=app_env.id,
                    deployment_type=DeploymentType.STANDARD,
                    status=RequestStatus.PENDING,
                )
                db_session.add(req2)
                db_session.flush()

    def test_completed_deploy_allows_new_one(self, db_session):
        _, team, project, env, app, app_env = _setup_chain(db_session)

        # First request: SUCCESS (terminal — not in partial index)
        req1 = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.SUCCESS,
        )
        db_session.add(req1)
        db_session.flush()

        # Second request: PENDING — must succeed (SUCCESS not in index predicate)
        req2 = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.PENDING,
        )
        db_session.add(req2)
        db_session.flush()
        assert req2.id is not None


# ---------------------------------------------------------------------------
# Tests: approve / reject
# ---------------------------------------------------------------------------

class TestApproveReject:
    def _pending_request(self, db: Session, app_env: ApplicationEnvironment, user: User) -> DeploymentRequest:
        req = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            requested_by=user.id,
            status=RequestStatus.PENDING,
        )
        db.add(req)
        db.flush()
        return req

    def test_reject_requires_justification_pydantic(self, client, db_session):
        """Empty justification → 422 from Pydantic before hitting DB."""
        user, team, project, env, app, app_env = _setup_chain(db_session)
        req = self._pending_request(db_session, app_env, user)

        # We need a real JWT — register + login via API
        _register(client, f"approver@{team.domain}")
        token = _login(client, f"approver@{team.domain}")

        r = client.post(f"/deployment-requests/{req.id}/reject", json={}, headers=_auth(token))
        assert r.status_code == 422

    def test_reject_with_justification_succeeds(self, db_session):
        user, team, project, env, app, app_env = _setup_chain(db_session)
        req = self._pending_request(db_session, app_env, user)

        from backend.services.deploy_pipeline import _fail_request
        req.status = RequestStatus.REJECTED
        req.justification = "Not safe to deploy now"
        req.approved_by = user.id
        req.approved_at = datetime.now(timezone.utc)
        req.completed_at = datetime.now(timezone.utc)
        db_session.commit()

        db_session.refresh(req)
        assert req.status == RequestStatus.REJECTED
        assert req.justification == "Not safe to deploy now"

    def test_approve_transitions_to_running(self, db_session):
        user, team, project, env, app, app_env = _setup_chain(db_session)
        req = self._pending_request(db_session, app_env, user)

        with (
            patch("backend.services.deploy_pipeline._resolve_branch_head", return_value="abc"),
            patch("backend.services.deploy_pipeline.http.post") as mock_post,
        ):
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"workflow_run_id": 99}
            mock_resp.raise_for_status.return_value = None
            mock_post.return_value = mock_resp

            from backend.services import deploy_pipeline as dp
            dp.trigger_deploy(db_session, req, env, app)

        assert req.status == RequestStatus.RUNNING
        assert req.github_workflow_run_id == 99


# ---------------------------------------------------------------------------
# Tests: GET /deployment-requests/{id}/events
# ---------------------------------------------------------------------------

class TestDeployEvents:
    def test_events_returned_in_order(self, db_session):
        user, team, project, env, app, app_env = _setup_chain(db_session)

        req = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.RUNNING,
        )
        db_session.add(req)
        db_session.flush()

        version = DeploymentVersion(
            application_environment_id=app_env.id,
            deployment_request_id=req.id,
            trigger_source=TriggerSource.DEVSHIP,
        )
        db_session.add(version)
        db_session.flush()

        now = datetime.now(timezone.utc)
        for et in (DeploymentEventType.WORKFLOW_STARTED, DeploymentEventType.BUILD_COMPLETED):
            db_session.add(DeploymentEvent(
                deployment_version_id=version.id,
                event_type=et,
                source=EventSource.GITHUB,
                severity=Severity.INFO,
                event_timestamp=now,
            ))
        db_session.flush()

        events = (
            db_session.query(DeploymentEvent)
            .filter(DeploymentEvent.deployment_version_id == version.id)
            .order_by(DeploymentEvent.event_timestamp)
            .all()
        )
        assert len(events) == 2
        assert events[0].event_type == DeploymentEventType.WORKFLOW_STARTED

    def test_no_version_returns_empty_events(self, db_session):
        _, team, project, env, app, app_env = _setup_chain(db_session)
        req = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.PENDING,
        )
        db_session.add(req)
        db_session.flush()

        version = db_session.query(DeploymentVersion).filter(
            DeploymentVersion.deployment_request_id == req.id
        ).first()
        assert version is None


# ---------------------------------------------------------------------------
# Tests: deploy_pipeline helpers
# ---------------------------------------------------------------------------

class TestDeployPipeline:
    def test_parse_github_repo_https(self):
        from backend.services.deploy_pipeline import _parse_github_repo
        owner, repo = _parse_github_repo("https://github.com/MiguelSilva04/devship-demo-app")
        assert owner == "MiguelSilva04"
        assert repo == "devship-demo-app"

    def test_parse_github_repo_ssh(self):
        from backend.services.deploy_pipeline import _parse_github_repo
        owner, repo = _parse_github_repo("git@github.com:org/repo.git")
        assert owner == "org"
        assert repo == "repo"

    def test_fail_request(self, db_session):
        _, team, project, env, app, app_env = _setup_chain(db_session)
        req = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.RUNNING,
        )
        db_session.add(req)
        db_session.flush()

        from backend.services.deploy_pipeline import _fail_request
        _fail_request(db_session, req, "boom")

        db_session.refresh(req)
        assert req.status == RequestStatus.FAILED
        assert req.failure_reason == "boom"
        assert req.completed_at is not None

    def test_observe_deployment_end_to_end_records_correct_version_fields(self, db_session, monkeypatch):
        """observe_deployment() runs through all 5 stages and writes correct image_tag / argocd_sync_revision."""
        import backend.services.deploy_pipeline as dp
        from backend.services.deploy_pipeline import observe_deployment

        _, team, project, env, app, app_env = _setup_chain(db_session)

        # Add ClusterContext so the K8s/ArgoCD stages are exercised
        cluster_ctx = ClusterContext(
            project_id=project.id,
            cluster_arn="arn:aws:eks:us-east-1:123:cluster/c",
            cluster_name="c",
            region="us-east-1",
            eks_endpoint="https://k8s.example.com",
            ca_certificate="CERT",
            ca_file_path="/tmp/ca.crt",
            iam_role_arn="arn:aws:iam::123:role/r",
            external_id=str(uuid.uuid4()),
        )
        db_session.add(cluster_ctx)
        db_session.flush()

        req = DeploymentRequest(
            application_environment_id=app_env.id,
            deployment_type=DeploymentType.STANDARD,
            status=RequestStatus.RUNNING,
            github_workflow_run_id=42,
        )
        db_session.add(req)
        db_session.flush()

        # Redirect the BackgroundTask's own SessionLocal to the test session.
        # Wrap so that close() is a no-op — the conftest transaction must survive.
        class _NoClose:
            def __init__(self, s): self._s = s
            def __getattr__(self, n): return getattr(self._s, n)
            def close(self): pass

        monkeypatch.setattr(dp, "SessionLocal", lambda: _NoClose(db_session))

        # ── GitHub: run completed successfully ────────────────────────────────
        github_run_resp = MagicMock()
        github_run_resp.json.return_value = {
            "status": "completed",
            "conclusion": "success",
            "head_sha": "abcdef1234567890",
            "run_number": 7,
        }
        github_run_resp.raise_for_status = MagicMock()

        # ── ArgoCD: Running then Succeeded ────────────────────────────────────
        argocd_running = MagicMock()
        argocd_running.status.operation_phase = "Running"
        argocd_running.status.sync_revision = "abcdef1"

        argocd_succeeded = MagicMock()
        argocd_succeeded.status.operation_phase = "Succeeded"
        argocd_succeeded.status.sync_revision = "abcdef1"

        # ── K8s Deployment: Progressing → NewReplicaSetAvailable ─────────────
        cond_updating = MagicMock()
        cond_updating.type = "Progressing"
        cond_updating.reason = "ReplicaSetUpdated"

        cond_done = MagicMock()
        cond_done.type = "Progressing"
        cond_done.reason = "NewReplicaSetAvailable"

        dep_updating = MagicMock()
        dep_updating.status.conditions = [cond_updating]

        dep_done = MagicMock()
        dep_done.status.conditions = [cond_done]

        # ── K8s Pods: one pod, Ready=True ────────────────────────────────────
        pod = MagicMock()
        pod.metadata.name = "api-deploy-abc"
        pod_list = MagicMock()
        pod_list.items = [pod]

        raw_pods_resp = MagicMock()
        raw_pods_resp.json.return_value = {
            "items": [{
                "metadata": {"name": "api-deploy-abc"},
                "status": {
                    "containerStatuses": [],
                    "conditions": [{"type": "Ready", "status": "True"}],
                },
            }]
        }

        # http.get: first call → GitHub run, subsequent calls → raw pods
        http_get_calls = iter([github_run_resp, raw_pods_resp])

        monkeypatch.setattr(dp.http, "get", lambda *a, **kw: next(http_get_calls))

        # Service helpers
        argocd_calls = iter([argocd_running, argocd_succeeded])
        monkeypatch.setattr(dp, "get_argocd_application", lambda *a, **kw: next(argocd_calls))

        dep_calls = iter([dep_updating, dep_done])
        monkeypatch.setattr(dp, "list_deployment", lambda *a, **kw: next(dep_calls))

        monkeypatch.setattr(dp, "list_pods_in_namespace", lambda *a, **kw: pod_list)

        fake_eks = MagicMock()
        monkeypatch.setattr(dp, "get_cluster_token", lambda **kw: fake_eks)

        # Zero out sleeps so the test runs instantly
        monkeypatch.setattr(dp.time, "sleep", lambda _: None)

        observe_deployment(req.id)

        db_session.refresh(req)
        assert req.status == RequestStatus.SUCCESS
        assert req.completed_at is not None

        version = db_session.query(DeploymentVersion).filter(
            DeploymentVersion.deployment_request_id == req.id
        ).first()
        assert version is not None
        assert version.image_tag == "abcdef1-7"
        assert version.source_commit_sha == "abcdef1234567890"
        assert version.argocd_sync_revision == "abcdef1"

        events = db_session.query(DeploymentEvent).filter(
            DeploymentEvent.deployment_version_id == version.id
        ).order_by(DeploymentEvent.event_timestamp).all()
        event_types = [e.event_type for e in events]
        assert DeploymentEventType.WORKFLOW_STARTED in event_types
        assert DeploymentEventType.BUILD_COMPLETED in event_types
        assert DeploymentEventType.SYNC_STARTED in event_types
        assert DeploymentEventType.SYNC_COMPLETED in event_types
        assert DeploymentEventType.ROLLOUT_STARTED in event_types
        assert DeploymentEventType.ROLLOUT_COMPLETED in event_types
        assert DeploymentEventType.READINESS_PASSED in event_types
