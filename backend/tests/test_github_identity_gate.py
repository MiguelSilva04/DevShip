"""
Tests for DEV-11 Subtask 3 — GitHub identity gate on Deploy/Rollback.

Covers the DoD scenarios: no github_username -> 403, non-collaborator -> 403,
collaborator-but-not-author -> 201 with warning (deploy only), collaborator
and author -> 201 no warning, and PATCH /users/me/github-identity validation.
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
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus
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
    """Team + CLOUD_ENGINEER user + one Application/Environment/ApplicationEnvironment."""
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
        ci_workflow_file="deploy.yml",
    )
    db_session.add(app_)
    db_session.flush()

    ae = ApplicationEnvironment(application_id=app_.id, environment_id=env.id, deployment_name="api-deploy")
    db_session.add(ae)
    db_session.flush()

    return {"user": user, "team": team, "project": project, "env": env, "app": app_, "ae": ae}


class TestDeployGate:
    def test_403_without_github_username(self, client, db_session, scenario):
        token = _token_for(scenario["user"])
        r = client.post(
            f"/application-environments/{scenario['ae'].id}/deploy",
            json={"justification": "x"},
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_403_when_not_collaborator(self, client, db_session, scenario):
        scenario["user"].github_username = "octocat"
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.deploy.is_repo_collaborator", return_value=False):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/deploy",
                json={"justification": "x"},
                headers=_auth(token),
            )
        assert r.status_code == 403

    def test_201_with_warning_when_not_author(self, client, db_session, scenario):
        scenario["user"].github_username = "octocat"
        scenario["user"].github_email = "octocat@example.com"
        db_session.flush()
        token = _token_for(scenario["user"])

        with (
            patch("backend.api.routes.deploy.is_repo_collaborator", return_value=True),
            patch(
                "backend.api.routes.deploy.get_branch_head_commit",
                return_value={"sha": "abc123", "author_email": "someone-else@example.com"},
            ),
            patch("backend.services.deploy_pipeline.trigger_deploy"),
        ):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/deploy",
                json={"justification": "x"},
                headers=_auth(token),
            )
        assert r.status_code == 201, r.text
        assert r.json()["warning"] is not None

    def test_201_no_warning_when_author(self, client, db_session, scenario):
        scenario["user"].github_username = "octocat"
        scenario["user"].github_email = "octocat@example.com"
        db_session.flush()
        token = _token_for(scenario["user"])

        with (
            patch("backend.api.routes.deploy.is_repo_collaborator", return_value=True),
            patch(
                "backend.api.routes.deploy.get_branch_head_commit",
                return_value={"sha": "abc123", "author_email": "octocat@example.com"},
            ),
            patch("backend.services.deploy_pipeline.trigger_deploy"),
        ):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/deploy",
                json={"justification": "x"},
                headers=_auth(token),
            )
        assert r.status_code == 201, r.text
        assert r.json()["warning"] is None

    def test_confirmed_skips_authorship_recheck(self, client, db_session, scenario):
        """confirmed=true means the frontend already showed the warning once — the
        second call must not re-run get_branch_head_commit at all."""
        scenario["user"].github_username = "octocat"
        scenario["user"].github_email = "octocat@example.com"
        db_session.flush()
        token = _token_for(scenario["user"])

        with (
            patch("backend.api.routes.deploy.is_repo_collaborator", return_value=True),
            patch("backend.api.routes.deploy.get_branch_head_commit") as mock_head,
            patch("backend.services.deploy_pipeline.trigger_deploy"),
        ):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/deploy",
                json={"justification": "x", "confirmed": True},
                headers=_auth(token),
            )
        assert r.status_code == 201, r.text
        assert r.json()["warning"] is None
        mock_head.assert_not_called()


class TestRollbackGate:
    def test_403_without_github_username(self, client, db_session, scenario):
        token = _token_for(scenario["user"])

        r = client.post(
            f"/application-environments/{scenario['ae'].id}/rollback",
            json={},
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_403_when_not_collaborator(self, client, db_session, scenario):
        scenario["user"].github_username = "octocat"
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.deploy.is_repo_collaborator", return_value=False):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/rollback",
                json={},
                headers=_auth(token),
            )
        assert r.status_code == 403

    def test_never_checks_authorship(self, client, db_session, scenario):
        """Rollback must never call get_branch_head_commit — authorship is deploy-only."""
        scenario["user"].github_username = "octocat"
        scenario["user"].github_email = "octocat@example.com"
        db_session.flush()
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        target = DeploymentVersion(
            application_environment_id=scenario["ae"].id,
            lifecycle_status=LifecycleStatus.HEALTHY,
            image_tag="v1",
            created_at=now,
        )
        db_session.add(target)
        db_session.flush()
        current = DeploymentVersion(
            application_environment_id=scenario["ae"].id,
            lifecycle_status=LifecycleStatus.DEGRADED,
            image_tag="v2",
            created_at=now + timedelta(seconds=1),
        )
        db_session.add(current)
        db_session.flush()
        token = _token_for(scenario["user"])

        with (
            patch("backend.api.routes.deploy.is_repo_collaborator", return_value=True),
            patch("backend.api.routes.deploy.get_branch_head_commit") as mock_head,
            patch("backend.services.deploy_pipeline.trigger_deploy"),
        ):
            r = client.post(
                f"/application-environments/{scenario['ae'].id}/rollback",
                json={},
                headers=_auth(token),
            )
        assert r.status_code == 201, r.text
        assert r.json()["warning"] is None
        mock_head.assert_not_called()


class TestGithubIdentityEndpoint:
    def test_accepts_without_any_application_team_member(self, client, db_session, scenario):
        token = _token_for(scenario["user"])
        r = client.patch(
            "/users/me/github-identity",
            json={"github_username": "octocat", "github_email": "octocat@example.com"},
            headers=_auth(token),
        )
        assert r.status_code == 200, r.text
        assert r.json()["github_username"] == "octocat"

    def test_rejects_non_collaborator_with_existing_grant(self, client, db_session, scenario):
        member = (
            db_session.query(TeamMember)
            .filter(TeamMember.user_id == scenario["user"].id, TeamMember.team_id == scenario["team"].id)
            .first()
        )
        db_session.add(ApplicationTeamMember(team_member_id=member.id, application_id=scenario["app"].id))
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.onboarding.is_repo_collaborator", return_value=False):
            r = client.patch(
                "/users/me/github-identity",
                json={"github_username": "not-a-collaborator", "github_email": "x@example.com"},
                headers=_auth(token),
            )
        assert r.status_code == 403

    def test_accepts_collaborator_with_existing_grant(self, client, db_session, scenario):
        member = (
            db_session.query(TeamMember)
            .filter(TeamMember.user_id == scenario["user"].id, TeamMember.team_id == scenario["team"].id)
            .first()
        )
        db_session.add(ApplicationTeamMember(team_member_id=member.id, application_id=scenario["app"].id))
        db_session.flush()
        token = _token_for(scenario["user"])

        with patch("backend.api.routes.onboarding.is_repo_collaborator", return_value=True):
            r = client.patch(
                "/users/me/github-identity",
                json={"github_username": "octocat", "github_email": "octocat@example.com"},
                headers=_auth(token),
            )
        assert r.status_code == 200, r.text

    def test_rejects_username_already_claimed_by_another_account(self, client, db_session, scenario):
        other = User(name="Other", email=f"{uuid.uuid4()}@t.io", password_hash="x", github_username="octocat")
        db_session.add(other)
        db_session.flush()
        token = _token_for(scenario["user"])

        r = client.patch(
            "/users/me/github-identity",
            json={"github_username": "octocat", "github_email": "someone-else@example.com"},
            headers=_auth(token),
        )
        assert r.status_code == 409

    def test_rejects_email_already_claimed_by_another_account(self, client, db_session, scenario):
        other = User(name="Other", email=f"{uuid.uuid4()}@t.io", password_hash="x", github_email="octocat@example.com")
        db_session.add(other)
        db_session.flush()
        token = _token_for(scenario["user"])

        r = client.patch(
            "/users/me/github-identity",
            json={"github_username": "someone-else", "github_email": "octocat@example.com"},
            headers=_auth(token),
        )
        assert r.status_code == 409

    def test_allows_updating_own_existing_identity(self, client, db_session, scenario):
        scenario["user"].github_username = "octocat"
        scenario["user"].github_email = "octocat@example.com"
        db_session.flush()
        token = _token_for(scenario["user"])

        r = client.patch(
            "/users/me/github-identity",
            json={"github_username": "octocat", "github_email": "octocat@example.com"},
            headers=_auth(token),
        )
        assert r.status_code == 200, r.text
