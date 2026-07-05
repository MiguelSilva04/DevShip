"""
Tests for GET /application-environments/{id}/pending-commits and the
compare_commits() helper it relies on.
"""
import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))

from backend.api.main import app
from backend.api.deps import get_db
from backend.api.security import create_token
from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus, TriggerSource
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project, SetupStatus
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User


@pytest.fixture
def client(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _token_for(user):
    return create_token(str(user.id))


@pytest.fixture
def scenario(db_session):
    user = User(name="U", email=f"{uuid.uuid4()}@t.io", password_hash="x")
    team = Team(name="T", domain=f"{uuid.uuid4()}.t")
    db_session.add_all([user, team])
    db_session.flush()
    db_session.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None))
    db_session.flush()

    project = Project(team_id=team.id, name="P", setup_status=SetupStatus.CONFIGURED)
    db_session.add(project)
    db_session.flush()

    env = Environment(project_id=project.id, name="staging", deployment_order=0, source_branch="main")
    db_session.add(env)
    db_session.flush()

    app_ = Application(
        project_id=project.id, name="api",
        source_repository="https://github.com/org/api",
        container_registry_repository="ecr/org/api",
        ci_workflow_file="deploy.yml",
    )
    db_session.add(app_)
    db_session.flush()

    ae = ApplicationEnvironment(application_id=app_.id, environment_id=env.id, deployment_name="api-deploy")
    db_session.add(ae)
    db_session.flush()

    return {"user": user, "team": team, "project": project, "env": env, "app": app_, "ae": ae}


class TestGetPendingCommits:
    def test_no_current_version_returns_reason(self, client, db_session, scenario):
        token = _token_for(scenario["user"])
        r = client.get(f"/application-environments/{scenario['ae'].id}/pending-commits", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["commits"] == []
        assert data["reason"]

    def test_github_failure_returns_reason(self, client, db_session, scenario):
        version = DeploymentVersion(
            application_environment_id=scenario["ae"].id,
            lifecycle_status=LifecycleStatus.HEALTHY,
            trigger_source=TriggerSource.DEVSHIP,
            source_commit_sha="c4d5e6f0000000000000000000000000000000",
        )
        db_session.add(version)
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.visibility.compare_commits", return_value=None):
            r = client.get(f"/application-environments/{scenario['ae'].id}/pending-commits", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["commits"] == []
        assert data["reason"]
        assert data["current_sha"] == "c4d5e6f0000000000000000000000000000000"

    def test_returns_commits_from_compare(self, client, db_session, scenario):
        version = DeploymentVersion(
            application_environment_id=scenario["ae"].id,
            lifecycle_status=LifecycleStatus.HEALTHY,
            trigger_source=TriggerSource.DEVSHIP,
            source_commit_sha="c4d5e6f0000000000000000000000000000000",
        )
        db_session.add(version)
        db_session.flush()
        token = _token_for(scenario["user"])

        fake_commits = [
            {"sha": "a3f5b8c0000000000000000000000000000000", "type": "feat", "message": "adicionar cache layer", "author": "john.doe", "date": "2026-06-12T10:00:00Z"},
            {"sha": "bbb0000000000000000000000000000000000", "type": "fix", "message": "corrigir timeout", "author": "jane.smith", "date": "2026-06-11T10:00:00Z"},
        ]
        with patch("backend.api.routes.visibility.compare_commits", return_value=fake_commits):
            r = client.get(f"/application-environments/{scenario['ae'].id}/pending-commits", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["reason"] is None
        assert len(data["commits"]) == 2
        assert data["commits"][0]["type"] == "feat"
        assert data["head_sha"] == "a3f5b8c0000000000000000000000000000000"

    def test_no_new_commits_returns_empty_list_no_reason(self, client, db_session, scenario):
        version = DeploymentVersion(
            application_environment_id=scenario["ae"].id,
            lifecycle_status=LifecycleStatus.HEALTHY,
            trigger_source=TriggerSource.DEVSHIP,
            source_commit_sha="c4d5e6f0000000000000000000000000000000",
        )
        db_session.add(version)
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.visibility.compare_commits", return_value=[]):
            r = client.get(f"/application-environments/{scenario['ae'].id}/pending-commits", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["commits"] == []
        assert data["reason"] is None
        assert data["head_sha"] == data["current_sha"]

    def test_403_for_other_team(self, client, db_session, scenario):
        other_team = Team(name="Other", domain=f"{uuid.uuid4()}.t")
        db_session.add(other_team)
        db_session.flush()
        other_user = User(name="X", email=f"{uuid.uuid4()}@t.io", password_hash="x")
        db_session.add(other_user)
        db_session.flush()
        db_session.add(TeamMember(team_id=other_team.id, user_id=other_user.id, role=TeamMemberRole.CLOUD_ENGINEER, added_by=None))
        db_session.flush()
        token = _token_for(other_user)

        r = client.get(f"/application-environments/{scenario['ae'].id}/pending-commits", headers=_auth(token))
        assert r.status_code == 403


class TestCompareCommits:
    def test_parses_conventional_commit_type(self):
        from backend.services.gitops_scanner import compare_commits

        fake_response = {
            "commits": [
                {
                    "sha": "aaa",
                    "commit": {"message": "fix: corrigir timeout", "author": {"name": "jane.smith", "date": "2026-06-11T10:00:00Z"}},
                },
                {
                    "sha": "bbb",
                    "commit": {"message": "feat(cache): adicionar cache layer", "author": {"name": "john.doe", "date": "2026-06-12T10:00:00Z"}},
                },
            ]
        }
        with patch("backend.services.gitops_scanner.requests.get") as mock_get:
            mock_get.return_value.raise_for_status.return_value = None
            mock_get.return_value.json.return_value = fake_response
            result = compare_commits("https://github.com/org/api", "base_sha", "main")

        assert result is not None
        # reversed: oldest (bbb... wait, input order is aaa,bbb — reversed gives bbb,aaa)
        shas = [c["sha"] for c in result]
        assert shas == ["bbb", "aaa"]
        by_sha = {c["sha"]: c for c in result}
        assert by_sha["aaa"]["type"] == "fix"
        assert by_sha["aaa"]["message"] == "corrigir timeout"
        assert by_sha["bbb"]["type"] == "feat"
        assert by_sha["bbb"]["message"] == "adicionar cache layer"

    def test_non_conventional_message_has_no_type(self):
        from backend.services.gitops_scanner import compare_commits

        fake_response = {
            "commits": [
                {"sha": "aaa", "commit": {"message": "Merge pull request #12", "author": {"name": "bot", "date": "2026-06-11T10:00:00Z"}}},
            ]
        }
        with patch("backend.services.gitops_scanner.requests.get") as mock_get:
            mock_get.return_value.raise_for_status.return_value = None
            mock_get.return_value.json.return_value = fake_response
            result = compare_commits("https://github.com/org/api", "base_sha", "main")

        assert result[0]["type"] is None
        assert result[0]["message"] == "Merge pull request #12"

    def test_github_failure_returns_none(self):
        from backend.services.gitops_scanner import compare_commits

        with patch("backend.services.gitops_scanner.requests.get", side_effect=Exception("network error")):
            result = compare_commits("https://github.com/org/api", "base_sha", "main")
        assert result is None
