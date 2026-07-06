"""
Tests for DEV-11 Subtask 2 — Team member management (PATCH/DELETE) and candidates.

Covers the DoD scenarios: role-change grant cleanup, application_ids required when
moving to DEVELOPER, last-CLOUD_ENGINEER protection on DELETE, TECH_LEAD managing
DEVELOPERs, and candidate-list domain matching.
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
from backend.bd.models.application_team_member import ApplicationTeamMember
from backend.bd.models.team import Team
from backend.bd.models.team_member import TeamMember, TeamMemberRole
from backend.bd.models.project import Project, SetupStatus
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


def _make_member(db, team, user, role):
    m = TeamMember(team_id=team.id, user_id=user.id, role=role, added_by=None)
    db.add(m)
    db.flush()
    return m


def _make_app(db, project, name="api"):
    a = Application(
        project_id=project.id, name=name,
        source_repository=f"https://github.com/org/{name}-{uuid.uuid4().hex[:4]}",
        ci_workflow_file="deploy.yml",
    )
    db.add(a)
    db.flush()
    return a


@pytest.fixture
def scenario(db_session):
    team = Team(name="T", domain=f"{uuid.uuid4()}.t")
    db_session.add(team)
    db_session.flush()
    project = Project(team_id=team.id, name="P", setup_status=SetupStatus.CONFIGURED)
    db_session.add(project)
    db_session.flush()

    ce_user = _make_user(db_session)
    ce_member = _make_member(db_session, team, ce_user, TeamMemberRole.CLOUD_ENGINEER)

    app_a = _make_app(db_session, project, "app-a")
    app_b = _make_app(db_session, project, "app-b")

    return {
        "team": team, "project": project,
        "ce_user": ce_user, "ce_member": ce_member,
        "app_a": app_a, "app_b": app_b,
    }


class TestPatchRoleChange:
    def test_developer_to_tech_lead_deletes_grants(self, client, db_session, scenario):
        dev_user = _make_user(db_session)
        dev_member = _make_member(db_session, scenario["team"], dev_user, TeamMemberRole.DEVELOPER)
        db_session.add(ApplicationTeamMember(team_member_id=dev_member.id, application_id=scenario["app_a"].id))
        db_session.flush()
        token = _token_for(scenario["ce_user"])

        r = client.patch(
            f"/teams/{scenario['team'].id}/members/{dev_member.id}",
            json={"role": "TECH_LEAD"},
            headers=_auth(token),
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "TECH_LEAD"
        assert r.json()["application_ids"] == []

        remaining = (
            db_session.query(ApplicationTeamMember)
            .filter(ApplicationTeamMember.team_member_id == dev_member.id)
            .count()
        )
        assert remaining == 0

    def test_to_developer_without_application_ids_400s(self, client, db_session, scenario):
        tl_user = _make_user(db_session)
        tl_member = _make_member(db_session, scenario["team"], tl_user, TeamMemberRole.TECH_LEAD)
        token = _token_for(scenario["ce_user"])

        r = client.patch(
            f"/teams/{scenario['team'].id}/members/{tl_member.id}",
            json={"role": "DEVELOPER"},
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_to_developer_with_application_ids_replaces_grants(self, client, db_session, scenario):
        tl_user = _make_user(db_session)
        tl_member = _make_member(db_session, scenario["team"], tl_user, TeamMemberRole.TECH_LEAD)
        token = _token_for(scenario["ce_user"])

        r = client.patch(
            f"/teams/{scenario['team'].id}/members/{tl_member.id}",
            json={"role": "DEVELOPER", "application_ids": [str(scenario["app_a"].id)]},
            headers=_auth(token),
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "DEVELOPER"
        assert r.json()["application_ids"] == [str(scenario["app_a"].id)]

    def test_empty_payload_is_noop(self, client, db_session, scenario):
        dev_user = _make_user(db_session)
        dev_member = _make_member(db_session, scenario["team"], dev_user, TeamMemberRole.DEVELOPER)
        token = _token_for(scenario["ce_user"])

        r = client.patch(
            f"/teams/{scenario['team'].id}/members/{dev_member.id}",
            json={},
            headers=_auth(token),
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "DEVELOPER"


class TestDeleteMember:
    def test_last_cloud_engineer_400s(self, client, db_session, scenario):
        token = _token_for(scenario["ce_user"])
        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{scenario['ce_member'].id}",
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_second_cloud_engineer_can_be_removed(self, client, db_session, scenario):
        ce2_user = _make_user(db_session)
        ce2_member = _make_member(db_session, scenario["team"], ce2_user, TeamMemberRole.CLOUD_ENGINEER)
        token = _token_for(scenario["ce_user"])

        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{ce2_member.id}",
            headers=_auth(token),
        )
        assert r.status_code == 204

    def test_tech_lead_removes_developer_cascades_grants(self, client, db_session, scenario):
        tl_user = _make_user(db_session)
        tl_member = _make_member(db_session, scenario["team"], tl_user, TeamMemberRole.TECH_LEAD)
        dev_user = _make_user(db_session)
        dev_member = _make_member(db_session, scenario["team"], dev_user, TeamMemberRole.DEVELOPER)
        db_session.add(ApplicationTeamMember(team_member_id=dev_member.id, application_id=scenario["app_a"].id))
        db_session.flush()
        dev_member_id = dev_member.id
        token = _token_for(tl_user)

        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{dev_member_id}",
            headers=_auth(token),
        )
        assert r.status_code == 204

        assert db_session.get(TeamMember, dev_member_id) is None
        remaining = (
            db_session.query(ApplicationTeamMember)
            .filter(ApplicationTeamMember.team_member_id == dev_member_id)
            .count()
        )
        assert remaining == 0

    def test_tech_lead_cannot_remove_another_tech_lead(self, client, db_session, scenario):
        tl1_user = _make_user(db_session)
        tl1_member = _make_member(db_session, scenario["team"], tl1_user, TeamMemberRole.TECH_LEAD)
        tl2_user = _make_user(db_session)
        tl2_member = _make_member(db_session, scenario["team"], tl2_user, TeamMemberRole.TECH_LEAD)
        token = _token_for(tl1_user)

        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{tl2_member.id}",
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_tech_lead_cannot_remove_cloud_engineer(self, client, db_session, scenario):
        tl_user = _make_user(db_session)
        _make_member(db_session, scenario["team"], tl_user, TeamMemberRole.TECH_LEAD)
        token = _token_for(tl_user)

        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{scenario['ce_member'].id}",
            headers=_auth(token),
        )
        assert r.status_code == 403

    def test_developer_cannot_remove_anyone(self, client, db_session, scenario):
        dev_user = _make_user(db_session)
        _make_member(db_session, scenario["team"], dev_user, TeamMemberRole.DEVELOPER)
        other_dev_user = _make_user(db_session)
        other_dev_member = _make_member(db_session, scenario["team"], other_dev_user, TeamMemberRole.DEVELOPER)
        token = _token_for(dev_user)

        r = client.delete(
            f"/teams/{scenario['team'].id}/members/{other_dev_member.id}",
            headers=_auth(token),
        )
        assert r.status_code == 403


class TestCandidates:
    def test_matching_domain_user_appears_as_candidate(self, client, db_session, scenario):
        domain = scenario["team"].domain
        _make_user(db_session, email=f"junior@{domain}")
        token = _token_for(scenario["ce_user"])

        r = client.get(f"/teams/{scenario['team'].id}/members", headers=_auth(token))
        assert r.status_code == 200
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert f"junior@{domain}" in candidate_emails

    def test_added_candidate_no_longer_listed(self, client, db_session, scenario):
        domain = scenario["team"].domain
        junior = _make_user(db_session, email=f"junior@{domain}")
        token = _token_for(scenario["ce_user"])

        r = client.post(
            f"/teams/{scenario['team'].id}/members",
            json={"user_id": str(junior.id), "role": "DEVELOPER", "application_ids": []},
            headers=_auth(token),
        )
        assert r.status_code == 201, r.text

        r2 = client.get(f"/teams/{scenario['team'].id}/members", headers=_auth(token))
        candidate_emails = [c["email"] for c in r2.json()["candidates"]]
        member_emails = [m["email"] for m in r2.json()["members"]]
        assert f"junior@{domain}" not in candidate_emails
        assert f"junior@{domain}" in member_emails

    def test_other_candidate_with_same_domain_still_listed(self, client, db_session, scenario):
        domain = scenario["team"].domain
        junior = _make_user(db_session, email=f"junior@{domain}")
        _make_user(db_session, email=f"senior@{domain}")
        token = _token_for(scenario["ce_user"])

        client.post(
            f"/teams/{scenario['team'].id}/members",
            json={"user_id": str(junior.id), "role": "DEVELOPER", "application_ids": []},
            headers=_auth(token),
        )

        r = client.get(f"/teams/{scenario['team'].id}/members", headers=_auth(token))
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert f"senior@{domain}" in candidate_emails

    def test_different_domain_not_a_candidate(self, client, db_session, scenario):
        _make_user(db_session, email="outsider@different-domain.io")
        token = _token_for(scenario["ce_user"])

        r = client.get(f"/teams/{scenario['team'].id}/members", headers=_auth(token))
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert "outsider@different-domain.io" not in candidate_emails
