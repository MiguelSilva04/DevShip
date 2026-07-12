"""
Tests for DEV-11 Subtask 1 — ApplicationTeamMember scoping.

Covers the DoD scenarios: DEVELOPER without/with grant, TECH_LEAD/CLOUD_ENGINEER
bypassing level 2, cross-team isolation, and Environment visibility per role.
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
from backend.bd.models.company import Company
from backend.bd.models.environment import Environment
from backend.bd.models.project import Project, SetupStatus
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.user import User


def _make_team(db, name="T"):
    company = Company(name=f"{uuid.uuid4()}.t", domain=f"{uuid.uuid4()}.t")
    db.add(company)
    db.flush()
    team = Team(name=name, company_id=company.id)
    db.add(team)
    db.flush()
    return team


@pytest.fixture
def client(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _token_for(user):
    return create_token(str(user.id))


def _make_user(db):
    u = User(name="U", email=f"{uuid.uuid4()}@t.io", password_hash="x")
    db.add(u)
    db.flush()
    return u


def _make_member(db, team, user, role):
    m = TeamMember(team_id=team.id, user_id=user.id, role=role, added_by=None)
    db.add(m)
    db.flush()
    return m


def _grant(db, member, application):
    db.add(ApplicationTeamMember(team_member_id=member.id, application_id=application.id))
    db.flush()


def _make_app(db, project, name="api"):
    a = Application(
        project_id=project.id,
        name=name,
        source_repository=f"https://github.com/org/{name}-{uuid.uuid4().hex[:4]}",
        ci_workflow_file="deploy.yml",
    )
    db.add(a)
    db.flush()
    return a


def _make_env(db, project, name="dev", order=0):
    e = Environment(project_id=project.id, name=name, deployment_order=order)
    db.add(e)
    db.flush()
    return e


def _make_ae(db, app, env):
    ae = ApplicationEnvironment(application_id=app.id, environment_id=env.id, deployment_name="d")
    db.add(ae)
    db.flush()
    return ae


@pytest.fixture
def scenario(db_session):
    """Team with two Applications (app_a, app_b), each with one Environment/ApplicationEnvironment."""
    team = _make_team(db_session)

    project = Project(team_id=team.id, name="P", setup_status=SetupStatus.CONFIGURED)
    db_session.add(project)
    db_session.flush()

    env_a = _make_env(db_session, project, "dev", 0)
    env_b = _make_env(db_session, project, "staging", 1)
    app_a = _make_app(db_session, project, "app-a")
    app_b = _make_app(db_session, project, "app-b")
    ae_a = _make_ae(db_session, app_a, env_a)
    ae_b = _make_ae(db_session, app_b, env_b)

    return {
        "team": team, "project": project,
        "env_a": env_a, "env_b": env_b,
        "app_a": app_a, "app_b": app_b,
        "ae_a": ae_a, "ae_b": ae_b,
    }


class TestDeveloperWithoutGrant:
    def test_403_on_get_application(self, client, db_session, scenario):
        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        token = _token_for(user)

        r = client.get(f"/applications/{scenario['app_a'].id}", headers=_auth(token))
        assert r.status_code == 403

    def test_403_on_get_pods(self, client, db_session, scenario):
        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        token = _token_for(user)

        r = client.get(f"/application-environments/{scenario['ae_a'].id}/pods", headers=_auth(token))
        assert r.status_code == 403

    def test_403_on_create_deploy(self, client, db_session, scenario):
        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        token = _token_for(user)

        r = client.post(
            f"/application-environments/{scenario['ae_a'].id}/deploy",
            json={"justification": "x"},
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_403_on_create_rollback(self, client, db_session, scenario):
        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        token = _token_for(user)

        r = client.post(
            f"/application-environments/{scenario['ae_a'].id}/rollback",
            json={"deployment_version_id": str(uuid.uuid4()), "justification": "x"},
            headers=_auth(token),
        )
        assert r.status_code == 403


class TestDeveloperWithGrant:
    def test_list_applications_shows_only_granted(self, client, db_session, scenario):
        user = _make_user(db_session)
        member = _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        _grant(db_session, member, scenario["app_a"])
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/applications", headers=_auth(token))
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert ids == {str(scenario["app_a"].id)}

    def test_get_application_granted_ok_other_403(self, client, db_session, scenario):
        user = _make_user(db_session)
        member = _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        _grant(db_session, member, scenario["app_a"])
        token = _token_for(user)

        ok = client.get(f"/applications/{scenario['app_a'].id}", headers=_auth(token))
        assert ok.status_code == 200

        forbidden = client.get(f"/applications/{scenario['app_b'].id}", headers=_auth(token))
        assert forbidden.status_code == 403


class TestTechLeadAndCloudEngineerBypassLevel2:
    @pytest.mark.parametrize("role", [TeamMemberRole.TECH_LEAD, TeamMemberRole.CLOUD_ENGINEER])
    def test_full_access_without_any_grant(self, client, db_session, scenario, role):
        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, role)
        token = _token_for(user)

        for app in (scenario["app_a"], scenario["app_b"]):
            r = client.get(f"/applications/{app.id}", headers=_auth(token))
            assert r.status_code == 200

        r = client.get(f"/projects/{scenario['project'].id}/applications", headers=_auth(token))
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert ids == {str(scenario["app_a"].id), str(scenario["app_b"].id)}


class TestOtherTeamIsolation:
    @pytest.mark.parametrize("role", [TeamMemberRole.DEVELOPER, TeamMemberRole.TECH_LEAD, TeamMemberRole.CLOUD_ENGINEER])
    def test_403_for_member_of_different_team(self, client, db_session, scenario, role):
        other_team = _make_team(db_session, name="Other")
        user = _make_user(db_session)
        _make_member(db_session, other_team, user, role)
        token = _token_for(user)

        r = client.get(f"/applications/{scenario['app_a'].id}", headers=_auth(token))
        assert r.status_code == 403

        r2 = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r2.status_code == 403


class TestListEnvironmentsScoping:
    def test_cloud_engineer_sees_all_including_unassociated(self, client, db_session, scenario):
        # Environment with no ApplicationEnvironment at all.
        env_empty = _make_env(db_session, scenario["project"], "empty", 2)

        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r.status_code == 200
        names = {e["name"] for e in r.json()}
        assert names == {"dev", "staging", "empty"}

    def test_tech_lead_sees_any_application_environment(self, client, db_session, scenario):
        _make_env(db_session, scenario["project"], "empty", 2)  # not visible to TECH_LEAD

        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.TECH_LEAD)
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r.status_code == 200
        names = {e["name"] for e in r.json()}
        assert names == {"dev", "staging"}

    def test_developer_sees_only_environments_of_granted_applications(self, client, db_session, scenario):
        user = _make_user(db_session)
        member = _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        _grant(db_session, member, scenario["app_a"])
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r.status_code == 200
        names = {e["name"] for e in r.json()}
        assert names == {"dev"}

    def test_application_names_populated_per_environment(self, client, db_session, scenario):
        env_empty = _make_env(db_session, scenario["project"], "empty", 2)

        user = _make_user(db_session)
        _make_member(db_session, scenario["team"], user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r.status_code == 200
        by_name = {e["name"]: e["application_names"] for e in r.json()}
        assert by_name["dev"] == [scenario["app_a"].name]
        assert by_name["staging"] == [scenario["app_b"].name]
        assert by_name["empty"] == []

    def test_developer_sees_environment_if_any_ae_is_granted(self, client, db_session, scenario):
        """Environment with AEs from two Applications, one granted — must stay visible."""
        ae_a_in_env_b = _make_ae(db_session, scenario["app_a"], scenario["env_b"])

        user = _make_user(db_session)
        member = _make_member(db_session, scenario["team"], user, TeamMemberRole.DEVELOPER)
        _grant(db_session, member, scenario["app_a"])
        token = _token_for(user)

        r = client.get(f"/projects/{scenario['project'].id}/environments", headers=_auth(token))
        assert r.status_code == 200
        names = {e["name"] for e in r.json()}
        assert names == {"dev", "staging"}
