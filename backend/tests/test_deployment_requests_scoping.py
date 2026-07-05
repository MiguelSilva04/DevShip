"""
Tests for the team-scoping fix on GET /deployment-requests, GET /deployment-requests/{id},
and GET /deployment-requests/{id}/events — previously unscoped, any authenticated user
could see every DeploymentRequest platform-wide.
"""
import os
import uuid

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
from backend.bd.models.deployment_request import DeploymentRequest, DeploymentType
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


def _make_user(db, email=None):
    u = User(name="U", email=email or f"{uuid.uuid4()}@t.io", password_hash="x")
    db.add(u)
    db.flush()
    return u


def _make_team_chain(db, app_name="api"):
    """team -> project -> env -> app -> ae, returns dict."""
    team = Team(name="T", domain=f"{uuid.uuid4()}.t")
    db.add(team)
    db.flush()
    project = Project(team_id=team.id, name="P", setup_status=SetupStatus.CONFIGURED)
    db.add(project)
    db.flush()
    env = Environment(project_id=project.id, name="dev", deployment_order=0)
    db.add(env)
    db.flush()
    app_ = Application(
        project_id=project.id, name=app_name,
        source_repository=f"https://github.com/org/{app_name}-{uuid.uuid4().hex[:4]}",
        container_registry_repository="ecr/org/api",
        ci_workflow_file="deploy.yml",
    )
    db.add(app_)
    db.flush()
    ae = ApplicationEnvironment(application_id=app_.id, environment_id=env.id, deployment_name="d")
    db.add(ae)
    db.flush()
    return {"team": team, "project": project, "env": env, "app": app_, "ae": ae}


def _make_member(db, team, user, role):
    m = TeamMember(team_id=team.id, user_id=user.id, role=role, added_by=None)
    db.add(m)
    db.flush()
    return m


def _make_request(db, ae):
    req = DeploymentRequest(
        application_environment_id=ae.id,
        deployment_type=DeploymentType.STANDARD,
    )
    db.add(req)
    db.flush()
    return req


class TestListDeployRequestsScoping:
    def test_user_only_sees_own_team_requests(self, client, db_session):
        chain_a = _make_team_chain(db_session, "app-a")
        chain_b = _make_team_chain(db_session, "app-b")
        req_a = _make_request(db_session, chain_a["ae"])
        req_b = _make_request(db_session, chain_b["ae"])

        user = _make_user(db_session)
        _make_member(db_session, chain_a["team"], user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get("/deployment-requests", headers=_auth(token))
        assert r.status_code == 200
        ids = {row["id"] for row in r.json()}
        assert str(req_a.id) in ids
        assert str(req_b.id) not in ids

    def test_developer_only_sees_granted_application_requests(self, client, db_session):
        chain = _make_team_chain(db_session, "app-a")
        chain_b_app = Application(
            project_id=chain["project"].id, name="app-b",
            source_repository=f"https://github.com/org/app-b-{uuid.uuid4().hex[:4]}",
            container_registry_repository="ecr/org/api", ci_workflow_file="deploy.yml",
        )
        db_session.add(chain_b_app)
        db_session.flush()
        ae_b = ApplicationEnvironment(application_id=chain_b_app.id, environment_id=chain["env"].id, deployment_name="d2")
        db_session.add(ae_b)
        db_session.flush()

        req_a = _make_request(db_session, chain["ae"])
        req_b = _make_request(db_session, ae_b)

        user = _make_user(db_session)
        member = _make_member(db_session, chain["team"], user, TeamMemberRole.DEVELOPER)
        db_session.add(ApplicationTeamMember(team_member_id=member.id, application_id=chain["app"].id))
        db_session.flush()
        token = _token_for(user)

        r = client.get("/deployment-requests", headers=_auth(token))
        assert r.status_code == 200
        ids = {row["id"] for row in r.json()}
        assert str(req_a.id) in ids
        assert str(req_b.id) not in ids

    def test_user_with_no_team_sees_nothing(self, client, db_session):
        chain = _make_team_chain(db_session)
        _make_request(db_session, chain["ae"])

        user = _make_user(db_session)
        token = _token_for(user)

        r = client.get("/deployment-requests", headers=_auth(token))
        assert r.status_code == 200
        assert r.json() == []


class TestGetDeployRequestScoping:
    def test_403_for_other_team_member(self, client, db_session):
        chain = _make_team_chain(db_session)
        req = _make_request(db_session, chain["ae"])

        other_team = Team(name="Other", domain=f"{uuid.uuid4()}.t")
        db_session.add(other_team)
        db_session.flush()
        user = _make_user(db_session)
        _make_member(db_session, other_team, user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/deployment-requests/{req.id}", headers=_auth(token))
        assert r.status_code == 403

    def test_200_for_own_team_member(self, client, db_session):
        chain = _make_team_chain(db_session)
        req = _make_request(db_session, chain["ae"])

        user = _make_user(db_session)
        _make_member(db_session, chain["team"], user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/deployment-requests/{req.id}", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["id"] == str(req.id)

    def test_403_for_developer_without_grant(self, client, db_session):
        chain = _make_team_chain(db_session)
        req = _make_request(db_session, chain["ae"])

        user = _make_user(db_session)
        _make_member(db_session, chain["team"], user, TeamMemberRole.DEVELOPER)
        token = _token_for(user)

        r = client.get(f"/deployment-requests/{req.id}", headers=_auth(token))
        assert r.status_code == 403


class TestGetDeployEventsScoping:
    def test_403_for_other_team_member(self, client, db_session):
        chain = _make_team_chain(db_session)
        req = _make_request(db_session, chain["ae"])

        other_team = Team(name="Other", domain=f"{uuid.uuid4()}.t")
        db_session.add(other_team)
        db_session.flush()
        user = _make_user(db_session)
        _make_member(db_session, other_team, user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/deployment-requests/{req.id}/events", headers=_auth(token))
        assert r.status_code == 403

    def test_200_for_own_team_member(self, client, db_session):
        chain = _make_team_chain(db_session)
        req = _make_request(db_session, chain["ae"])

        user = _make_user(db_session)
        _make_member(db_session, chain["team"], user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/deployment-requests/{req.id}/events", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["request"]["id"] == str(req.id)
