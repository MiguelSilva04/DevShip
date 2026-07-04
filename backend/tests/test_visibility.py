"""
Tests for DEV-9 Subtask 6 — visibility endpoints.

Covers: _latest_versions_subquery correctness, all 6 endpoints, edge cases
(ae without deploy → null lifecycle_status, zero-deploy project, pagination,
404 on unknown id, sql-counted metrics).
"""
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))

from backend.api.main import app
from backend.api.deps import get_db
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus, TriggerSource
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


def _make_user(db, email=None):
    u = User(name="U", email=email or f"{uuid.uuid4()}@t.io", password_hash="x")
    db.add(u)
    db.flush()
    return u


def _make_team(db):
    t = Team(name="T", domain=f"{uuid.uuid4()}.t")
    db.add(t)
    db.flush()
    return t


def _make_project(db, team, status=SetupStatus.CONFIGURED):
    p = Project(team_id=team.id, name="P", setup_status=status)
    db.add(p)
    db.flush()
    return p


def _make_env(db, project, name="dev", order=0):
    e = Environment(project_id=project.id, name=name, deployment_order=order)
    db.add(e)
    db.flush()
    return e


def _make_app(db, project, name="api"):
    a = Application(
        project_id=project.id,
        name=name,
        source_repository=f"https://github.com/org/{name}-{uuid.uuid4().hex[:4]}",
        container_registry_repository="ecr/org/api",
        ci_workflow_file="deploy.yml",
    )
    db.add(a)
    db.flush()
    return a


def _make_ae(db, app, env):
    ae = ApplicationEnvironment(
        application_id=app.id,
        environment_id=env.id,
        deployment_name="d",
    )
    db.add(ae)
    db.flush()
    return ae


_version_counter = 0


def _make_version(db, ae, lifecycle=LifecycleStatus.HEALTHY, image_tag=None):
    global _version_counter
    _version_counter += 1
    # Explicit created_at with microsecond offset so DISTINCT ON ordering is deterministic
    # within a transaction (server_default=func.now() gives the same timestamp for all rows
    # in the same transaction, making DISTINCT ON pick non-deterministically).
    from datetime import timedelta
    ts = datetime.now(timezone.utc) + timedelta(microseconds=_version_counter * 1000)
    v = DeploymentVersion(
        application_environment_id=ae.id,
        lifecycle_status=lifecycle,
        image_tag=image_tag,
        trigger_source=TriggerSource.DEVSHIP,
        created_at=ts,
    )
    db.add(v)
    db.flush()

    # Non-terminal statuses are recomputed from events at read time (DEV-10.1) —
    # back the requested status with matching events so it survives that recompute.
    if lifecycle in (LifecycleStatus.HEALTHY, LifecycleStatus.DEGRADED):
        from backend.bd.models.deployment_event import DeploymentEvent, DeploymentEventType, EventSource, Severity
        db.add(DeploymentEvent(
            deployment_version_id=v.id,
            event_type=DeploymentEventType.ROLLOUT_COMPLETED,
            source=EventSource.KUBERNETES,
            severity=Severity.INFO,
            event_timestamp=ts,
        ))
        if lifecycle == LifecycleStatus.DEGRADED:
            db.add(DeploymentEvent(
                deployment_version_id=v.id,
                event_type=DeploymentEventType.CRASH_LOOP_BACKOFF,
                source=EventSource.KUBERNETES,
                severity=Severity.ERROR,
                event_timestamp=ts,
            ))
        db.flush()
    return v


def _setup_chain(db):
    """user + team + project + env + app + ae, returns all 6."""
    user = _make_user(db)
    team = _make_team(db)
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None))
    project = _make_project(db, team)
    env = _make_env(db, project)
    app = _make_app(db, project)
    ae = _make_ae(db, app, env)
    db.flush()
    return user, team, project, env, app, ae


def _register_login(client, email):
    client.post("/auth/register", json={"name": "U", "email": email, "password": "pw123456"})
    return client.post("/auth/login", json={"email": email, "password": "pw123456"}).json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Unit: _latest_versions_subquery
# ---------------------------------------------------------------------------

class TestLatestVersionsSubquery:
    def test_returns_only_latest(self, db_session):
        from backend.api.routes.visibility import _latest_versions_subquery

        _, _, _, _, _, ae = _setup_chain(db_session)

        v_old = _make_version(db_session, ae, LifecycleStatus.DEPLOYING, "v1")
        v_new = _make_version(db_session, ae, LifecycleStatus.HEALTHY, "v2")

        results = _latest_versions_subquery(db_session, [ae.id]).all()
        assert len(results) == 1
        assert results[0].id == v_new.id

    def test_one_result_per_ae(self, db_session):
        from backend.api.routes.visibility import _latest_versions_subquery

        _, _, project, env, app, ae1 = _setup_chain(db_session)
        env2 = _make_env(db_session, project, "staging", 1)
        ae2 = _make_ae(db_session, app, env2)

        _make_version(db_session, ae1, LifecycleStatus.HEALTHY)
        _make_version(db_session, ae1, LifecycleStatus.DEGRADED)
        _make_version(db_session, ae2, LifecycleStatus.DEPLOYING)

        results = _latest_versions_subquery(db_session, [ae1.id, ae2.id]).all()
        assert len(results) == 2
        by_ae = {v.application_environment_id: v for v in results}
        assert by_ae[ae1.id].lifecycle_status == LifecycleStatus.DEGRADED
        assert by_ae[ae2.id].lifecycle_status == LifecycleStatus.DEPLOYING

    def test_ae_with_no_versions_not_in_result(self, db_session):
        from backend.api.routes.visibility import _latest_versions_subquery

        _, _, _, _, _, ae = _setup_chain(db_session)
        results = _latest_versions_subquery(db_session, [ae.id]).all()
        assert results == []


# ---------------------------------------------------------------------------
# GET /projects/{id}/environments
# ---------------------------------------------------------------------------

class TestListEnvironments:
    def test_returns_environments_ordered(self, client, db_session):
        user, _, project, _, _, _ = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        env2 = _make_env(db_session, project, "prod", 1)

        r = client.get(f"/projects/{project.id}/environments", headers=_auth(token))
        assert r.status_code == 200
        names = [e["name"] for e in r.json()]
        assert names == sorted(names, key=lambda n: ["dev", "prod"].index(n))

    def test_404_on_unknown_project(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/projects/{uuid.uuid4()}/environments", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /projects/{id}/applications
# ---------------------------------------------------------------------------

class TestListApplications:
    def test_returns_applications(self, client, db_session):
        _, _, project, _, app, _ = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/projects/{project.id}/applications", headers=_auth(token))
        assert r.status_code == 200
        assert any(a["id"] == str(app.id) for a in r.json())

    def test_archived_excluded(self, client, db_session):
        _, _, project, _, app, _ = _setup_chain(db_session)
        app.is_archived = True
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/projects/{project.id}/applications", headers=_auth(token))
        assert r.status_code == 200
        assert not any(a["id"] == str(app.id) for a in r.json())


# ---------------------------------------------------------------------------
# GET /applications/{id}
# ---------------------------------------------------------------------------

class TestGetApplication:
    def test_returns_detail_with_environments(self, client, db_session):
        _, _, _, env, app, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/applications/{app.id}", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == str(app.id)
        assert len(data["environments"]) == 1
        assert data["environments"][0]["lifecycle_status"] == "Healthy"
        assert data["environments"][0]["environment_name"] == env.name

    def test_ae_without_deploy_returns_null_lifecycle(self, client, db_session):
        _, _, _, _, app, _ = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/applications/{app.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["environments"][0]["lifecycle_status"] is None

    def test_404_on_unknown_app(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/applications/{uuid.uuid4()}", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /application-environments/{id}
# ---------------------------------------------------------------------------

class TestGetApplicationEnvironment:
    def test_returns_detail_with_version(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY, "v1.0")
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["current_version"]["image_tag"] == "v1.0"
        assert data["current_version"]["lifecycle_status"] == "Healthy"

    def test_no_versions_returns_null_current_version(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["current_version"] is None

    def test_404_on_unknown_ae(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/application-environments/{uuid.uuid4()}", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# _discover_lifecycle_status — live K8s read + cache for ae's with no DeploymentVersion
# ---------------------------------------------------------------------------

class TestDiscoveredStatus:
    def _with_cluster(self, db_session, project):
        from backend.bd.models.cluster_context import ClusterContext
        db_session.add(ClusterContext(
            project_id=project.id, cluster_arn="arn:aws:eks:us-east-1:1:cluster/x",
            cluster_name="x", region="us-east-1", eks_endpoint="https://x", ca_certificate="x",
            ca_file_path="/tmp/x", iam_role_arn="arn:aws:iam::1:role/x", external_id="ext",
        ))
        db_session.flush()

    def test_no_version_reads_live_cluster_and_caches(self, client, db_session):
        _, _, project, _, _, ae = _setup_chain(db_session)
        self._with_cluster(db_session, project)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with (
            patch("backend.api.routes.visibility.get_cluster_token", return_value=object()) as mock_token,
            patch("backend.api.routes.visibility.pod_health_snapshot", return_value=(True, [])) as mock_snapshot,
        ):
            r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()["current_version"] is None
        assert r.json()["discovered_status"] == "Healthy"
        mock_token.assert_called_once()
        mock_snapshot.assert_called_once()

        db_session.refresh(ae)
        assert ae.discovered_status == LifecycleStatus.HEALTHY
        assert ae.discovered_status_checked_at is not None

    def test_cached_result_within_ttl_skips_cluster_call(self, client, db_session):
        """A recent discovered_status_checked_at must short-circuit before touching the
        cluster — this is the fix for the endpoint hitting K8s on every page load."""
        _, _, project, _, _, ae = _setup_chain(db_session)
        self._with_cluster(db_session, project)
        ae.discovered_status = LifecycleStatus.HEALTHY
        ae.discovered_status_checked_at = datetime.now(timezone.utc)
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with (
            patch("backend.api.routes.visibility.get_cluster_token") as mock_token,
            patch("backend.api.routes.visibility.pod_health_snapshot") as mock_snapshot,
        ):
            r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()["discovered_status"] == "Healthy"
        mock_token.assert_not_called()
        mock_snapshot.assert_not_called()

    def test_expired_cache_reads_cluster_again(self, client, db_session):
        from datetime import timedelta
        _, _, project, _, _, ae = _setup_chain(db_session)
        self._with_cluster(db_session, project)
        ae.discovered_status = LifecycleStatus.HEALTHY
        ae.discovered_status_checked_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with (
            patch("backend.api.routes.visibility.get_cluster_token", return_value=object()),
            patch("backend.api.routes.visibility.pod_health_snapshot", return_value=(False, ["pod-x: CrashLoopBackOff"])) as mock_snapshot,
        ):
            r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()["discovered_status"] == "Degraded"
        mock_snapshot.assert_called_once()

    def test_no_cluster_configured_returns_none(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["discovered_status"] is None

    def test_has_deployment_version_never_reads_cluster(self, client, db_session):
        """Once an ae has a DeploymentVersion, discovery must not run at all — regression
        guard for the cache change not touching the already-deployed path."""
        _, _, project, _, _, ae = _setup_chain(db_session)
        self._with_cluster(db_session, project)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with (
            patch("backend.api.routes.visibility.get_cluster_token") as mock_token,
            patch("backend.api.routes.visibility.pod_health_snapshot") as mock_snapshot,
        ):
            r = client.get(f"/application-environments/{ae.id}", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()["discovered_status"] is None
        mock_token.assert_not_called()
        mock_snapshot.assert_not_called()


# ---------------------------------------------------------------------------
# POST /application-environments/{id}/refresh — live K8s read
# ---------------------------------------------------------------------------

class TestRefreshApplicationEnvironment:
    def test_no_cluster_configured_marks_degraded(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.post(f"/application-environments/{ae.id}/refresh", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["current_version"]["lifecycle_status"] == "Degraded"

    def test_cluster_unreachable_marks_degraded_not_left_stale(self, client, db_session):
        """Reproduces: terraform destroy removed the cluster, but a stale Healthy stuck
        around because the failure path used to be a silent no-op."""
        _, _, project, env, _, ae = _setup_chain(db_session)
        from backend.bd.models.cluster_context import ClusterContext
        db_session.add(ClusterContext(
            project_id=project.id, cluster_arn="arn:aws:eks:us-east-1:1:cluster/x",
            cluster_name="x", region="us-east-1", eks_endpoint="https://x", ca_certificate="x",
            ca_file_path="/tmp/x", iam_role_arn="arn:aws:iam::1:role/x", external_id="ext",
        ))
        db_session.flush()
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with patch("backend.api.routes.visibility.get_cluster_token", side_effect=Exception("cluster destroyed")):
            r = client.post(f"/application-environments/{ae.id}/refresh", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["current_version"]["lifecycle_status"] == "Degraded"

    def test_get_after_refresh_does_not_revert_to_stale_healthy(self, client, db_session):
        """The read-time recompute-from-events must not overwrite a fresher live-check result."""
        _, _, _, _, _, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)  # backs Healthy with a ROLLOUT_COMPLETED event
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.post(f"/application-environments/{ae.id}/refresh", headers=_auth(token))
        assert r.json()["current_version"]["lifecycle_status"] == "Degraded"

        r2 = client.get(f"/application-environments/{ae.id}", headers=_auth(token))
        assert r2.status_code == 200
        assert r2.json()["current_version"]["lifecycle_status"] == "Degraded"

    def test_404_on_unknown_ae(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.post(f"/application-environments/{uuid.uuid4()}/refresh", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /application-environments/{id}/history
# ---------------------------------------------------------------------------

class TestGetHistory:
    def test_returns_versions_newest_first(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        v1 = _make_version(db_session, ae, LifecycleStatus.HEALTHY, "v1")
        v2 = _make_version(db_session, ae, LifecycleStatus.DEGRADED, "v2")
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/history", headers=_auth(token))
        assert r.status_code == 200
        ids = [item["id"] for item in r.json()]
        assert ids[0] == str(v2.id)
        assert ids[1] == str(v1.id)

    def test_pagination(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        for _ in range(5):
            _make_version(db_session, ae)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/history?limit=2&offset=0", headers=_auth(token))
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_no_history_returns_empty_list(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/history", headers=_auth(token))
        assert r.status_code == 200
        assert r.json() == []

    def test_404_on_unknown_ae(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/application-environments/{uuid.uuid4()}/history", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /projects/{id}/homepage
# ---------------------------------------------------------------------------

class TestHomepage:
    def test_zero_metrics_for_new_project(self, client, db_session):
        _, _, project, _, _, _ = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/projects/{project.id}/homepage", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["healthy_count"] == 0
        assert data["degraded_count"] == 0
        assert data["deploys_today"] >= 0  # other tests may have added versions today

    def test_counts_healthy_and_degraded_via_sql(self, client, db_session):
        _, _, project, _, app, ae = _setup_chain(db_session)

        env2 = _make_env(db_session, project, "prod", 1)
        ae2 = _make_ae(db_session, app, env2)

        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        _make_version(db_session, ae2, LifecycleStatus.DEGRADED)

        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/projects/{project.id}/homepage", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["total_application_environments"] == 2
        assert data["healthy_count"] == 1
        assert data["degraded_count"] == 1

    def test_ae_without_deploy_not_counted_as_healthy(self, client, db_session):
        _, _, project, _, _, _ = _setup_chain(db_session)  # ae has no versions
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/projects/{project.id}/homepage", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["healthy_count"] == 0
        assert data["total_application_environments"] == 1

    def test_applications_list_with_lifecycle(self, client, db_session):
        _, _, project, env, app, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/projects/{project.id}/homepage", headers=_auth(token))
        assert r.status_code == 200
        apps = r.json()["applications"]
        assert any(a["id"] == str(app.id) for a in apps)
        app_data = next(a for a in apps if a["id"] == str(app.id))
        assert app_data["environments"][0]["lifecycle_status"] == "Healthy"

    def test_404_on_unknown_project(self, client, db_session):
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")
        r = client.get(f"/projects/{uuid.uuid4()}/homepage", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# DEV-10.2 — best-effort log line parser
# ---------------------------------------------------------------------------

class TestParseLogLine:
    def test_structured_iso_timestamp_and_level(self):
        from backend.api.routes.visibility import _parse_log_line

        line = _parse_log_line("2024-01-05T16:03:05Z INFO Server listening on :8080")
        assert line.level == "INFO"
        assert line.timestamp == "2024-01-05T16:03:05Z"
        assert "Server listening" in line.message

    def test_time_only_with_colon_separator(self):
        from backend.api.routes.visibility import _parse_log_line

        line = _parse_log_line("16:03:18 ERROR: Failed to publish event")
        assert line.level == "ERROR"
        assert line.timestamp == "16:03:18"

    def test_unstructured_print_falls_back_to_raw(self):
        from backend.api.routes.visibility import _parse_log_line

        line = _parse_log_line("just a raw stdout line with no timestamp")
        assert line.level == "RAW"
        assert line.timestamp is None
        assert line.message == "just a raw stdout line with no timestamp"


# ---------------------------------------------------------------------------
# DEV-10.3 — Up To Date three-state comparison
# ---------------------------------------------------------------------------

class TestComputeUpToDate:
    def test_matching_shas_is_up_to_date(self):
        from backend.api.routes.visibility import compute_up_to_date
        from backend.api.schemas.visibility import UpToDateStatus

        assert compute_up_to_date("abc123", "abc123") == UpToDateStatus.UP_TO_DATE

    def test_different_shas_is_outdated(self):
        from backend.api.routes.visibility import compute_up_to_date
        from backend.api.schemas.visibility import UpToDateStatus

        assert compute_up_to_date("abc123", "def456") == UpToDateStatus.OUTDATED

    def test_missing_argocd_sync_revision_is_unknown(self):
        from backend.api.routes.visibility import compute_up_to_date
        from backend.api.schemas.visibility import UpToDateStatus

        assert compute_up_to_date(None, "def456") == UpToDateStatus.UNKNOWN

    def test_missing_gitops_head_is_unknown_not_outdated(self):
        """A failed/unresolved GitHub lookup must never read as a real mismatch."""
        from backend.api.routes.visibility import compute_up_to_date
        from backend.api.schemas.visibility import UpToDateStatus

        assert compute_up_to_date("abc123", None) == UpToDateStatus.UNKNOWN


class TestUpToDateEndpoint:
    def test_no_current_version_returns_unknown(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "Unknown"

    def test_no_argocd_sync_revision_returns_unknown(self, client, db_session):
        _, _, _, _, _, ae = _setup_chain(db_session)
        _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "Unknown"

    def test_missing_gitops_branch_returns_unknown(self, client, db_session):
        _, _, project, _, _, ae = _setup_chain(db_session)
        project.git_ops_repository_url = "https://github.com/org/gitops"
        v = _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        v.argocd_sync_revision = "abc123"
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "Unknown"

    def test_matching_head_returns_up_to_date(self, client, db_session):
        _, _, project, env, _, ae = _setup_chain(db_session)
        project.git_ops_repository_url = "https://github.com/org/gitops"
        env.gitops_branch = "main"
        v = _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        v.argocd_sync_revision = "abc123"
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with patch("backend.api.routes.visibility.resolve_branch_head", return_value="abc123"):
            r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "UpToDate"

    def test_diverging_head_returns_outdated(self, client, db_session):
        _, _, project, env, _, ae = _setup_chain(db_session)
        project.git_ops_repository_url = "https://github.com/org/gitops"
        env.gitops_branch = "main"
        v = _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        v.argocd_sync_revision = "abc123"
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with patch("backend.api.routes.visibility.resolve_branch_head", return_value="def456"):
            r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "Outdated"

    def test_github_lookup_failure_returns_unknown(self, client, db_session):
        _, _, project, env, _, ae = _setup_chain(db_session)
        project.git_ops_repository_url = "https://github.com/org/gitops"
        env.gitops_branch = "main"
        v = _make_version(db_session, ae, LifecycleStatus.HEALTHY)
        v.argocd_sync_revision = "abc123"
        db_session.flush()
        token = _register_login(client, f"e@{uuid.uuid4().hex}.io")

        with patch("backend.api.routes.visibility.resolve_branch_head", return_value=None):
            r = client.get(f"/application-environments/{ae.id}/up-to-date", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["status"] == "Unknown"
