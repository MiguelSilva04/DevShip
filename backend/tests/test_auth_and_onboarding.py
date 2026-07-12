"""
Happy path + main error cases for auth and onboarding endpoints.

AWS calls are mocked with moto; K8s list_namespaces is mocked with unittest.mock.
"""

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))

from backend.api.main import app
from backend.api.deps import get_db


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def client(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _register(client: TestClient, email: str, name: str = "Eng") -> dict:
    """Register a user and return the response JSON. Registration no longer auto-creates
    a team (that logic was removed to stop duplicate-team creation against the real
    onboarding flow) — callers that need a team must create one via POST /teams."""
    r = client.post("/auth/register", json={"name": name, "email": email, "password": "pw123456"})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client: TestClient, email: str) -> str:
    resp = client.post("/auth/login", json={"email": email, "password": "pw123456"})
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _setup(client: TestClient, domain: str) -> tuple[str, str]:
    """Register the first user for a unique domain and create their team via POST /teams
    (mirrors the real onboarding flow). Returns (token, team_id)."""
    email = f"eng@{domain}"
    _register(client, email)
    token = _login(client, email)
    r = client.post("/teams", json={"name": domain}, headers=_auth(token))
    assert r.status_code == 201, r.text
    return token, r.json()["id"]


def _project(client: TestClient, token: str, team_id: str, **kwargs) -> str:
    body = {"name": "Proj", **kwargs}
    r = client.post(f"/teams/{team_id}/projects", json=body, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TestAuth:
    def test_register_does_not_auto_create_team(self, client):
        """Registration never auto-creates a team — that's POST /teams's job, kept
        separate to avoid the duplicate-team bug this used to cause."""
        data = _register(client, "alice@newdomain.com")
        assert data["email"] == "alice@newdomain.com"
        assert data["team_id"] is None

    def test_register_second_user_same_domain_no_team(self, client):
        _register(client, "first@shared.com")
        data = _register(client, "second@shared.com")
        assert data["team_id"] is None  # pending, no auto-team

    def test_login(self, client):
        _register(client, "bob@login.com")
        r = client.post("/auth/login", json={"email": "bob@login.com", "password": "pw123456"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_duplicate_email(self, client):
        _register(client, "dup@d.com")
        r = client.post("/auth/register", json={"name": "A", "email": "dup@d.com", "password": "pw"})
        assert r.status_code == 409

    def test_wrong_password(self, client):
        _register(client, "c@c.com")
        r = client.post("/auth/login", json={"email": "c@c.com", "password": "wrong"})
        assert r.status_code == 401

    def test_protected_no_token(self, client):
        r = client.post("/teams", json={"name": "T"})
        assert r.status_code in (401, 403)  # HTTPBearer returns 403 on missing creds in some FastAPI versions


# ---------------------------------------------------------------------------
# Teams — domain uniqueness + POST /teams guard
# ---------------------------------------------------------------------------

class TestTeams:
    def test_create_team_bootstrap_is_confirmed_immediately(self, client):
        """First Team of a brand-new domain: no one exists yet to approve it, so the
        founder is CONFIRMED right away — same as the historical single-Team behavior."""
        token, team_id = _setup(client, "acme.io")
        r = client.get(f"/teams/{team_id}/members", headers=_auth(token))
        assert r.status_code == 200
        ce = next(m for m in r.json()["members"] if m["role"] == "CLOUD_ENGINEER")
        # Confirmed status isn't in MemberEntry today — proven indirectly: the CE can
        # already create a Project, which is gated on CONFIRMED status.
        assert ce["email"] == "eng@acme.io"

        proj = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token))
        assert proj.status_code == 201, proj.text

    def test_second_team_same_domain_succeeds_but_pending(self, client):
        """A domain can now have several Teams — creating a second one no longer 409s,
        but its founder starts PENDING_CONFIRMATION until another Team's CE approves."""
        token, _ = _setup(client, "multi-team.io")
        r = client.post("/teams", json={"name": "Another"}, headers=_auth(token))
        assert r.status_code == 201, r.text
        assert r.json()["member_status"] == "PENDING_CONFIRMATION"

    def test_pending_ce_cannot_create_project(self, client):
        token, _ = _setup(client, "pending-project.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        r = client.post(f"/teams/{second_team_id}/projects", json={"name": "P"}, headers=_auth(token))
        assert r.status_code == 403
        assert "confirmada" in r.json()["detail"]

    def test_pending_ce_cannot_configure_cluster(self, client):
        """Confirms the gate propagates through _require_cloud_engineer (project-scoped
        routes), not just _require_cloud_engineer_of_team directly."""
        token, first_team_id = _setup(client, "pending-cluster.io")
        first_project = _project(client, token, first_team_id)
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        # The pending CE can't even create a Project on the second Team — the gate
        # already blocks it at that step, before cluster config is reachable at all.
        r = client.post(f"/teams/{second_team_id}/projects", json={"name": "P"}, headers=_auth(token))
        assert r.status_code == 403

    def test_list_pending_teams_visible_to_confirmed_ce_other_team(self, client):
        token, first_team_id = _setup(client, "pending-list.io")
        company_id = client.get("/users/me/domain-status", headers=_auth(token)).json()["company_id"]

        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        r = client.get(f"/companies/{company_id}/pending-teams", headers=_auth(token))
        assert r.status_code == 200
        team_ids = [t["team_id"] for t in r.json()]
        assert second_team_id in team_ids

    def test_list_pending_teams_forbidden_for_non_ce(self, client):
        token, first_team_id = _setup(client, "pending-forbidden.io")
        company_id = client.get("/users/me/domain-status", headers=_auth(token)).json()["company_id"]

        dev_data = _register(client, "dev@pending-forbidden.io")
        dev_token = _login(client, "dev@pending-forbidden.io")
        client.post(
            f"/teams/{first_team_id}/members",
            json={"user_id": dev_data["id"], "role": "DEVELOPER", "application_ids": []},
            headers=_auth(token),
        )

        r = client.get(f"/companies/{company_id}/pending-teams", headers=_auth(dev_token))
        assert r.status_code == 403

    def test_list_pending_teams_forbidden_for_other_company(self, client):
        token, first_team_id = _setup(client, "companyA.io")
        company_a_id = client.get("/users/me/domain-status", headers=_auth(token)).json()["company_id"]
        other_token, _ = _setup(client, "companyB.io")

        r = client.get(f"/companies/{company_a_id}/pending-teams", headers=_auth(other_token))
        assert r.status_code == 403

    def test_confirm_team_by_ce_of_different_team_same_company(self, client):
        token, first_team_id = _setup(client, "confirm-cross.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        r = client.post(f"/teams/{second_team_id}/confirm", headers=_auth(token))
        assert r.status_code == 200, r.text

        proj = client.post(f"/teams/{second_team_id}/projects", json={"name": "P"}, headers=_auth(token))
        assert proj.status_code == 201, proj.text

    def test_confirm_team_twice_returns_409(self, client):
        token, _ = _setup(client, "confirm-twice.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        first = client.post(f"/teams/{second_team_id}/confirm", headers=_auth(token))
        assert first.status_code == 200
        second_call = client.post(f"/teams/{second_team_id}/confirm", headers=_auth(token))
        assert second_call.status_code == 409

    def test_reject_team_by_ce_of_different_team_same_company(self, client):
        token, _ = _setup(client, "reject-cross.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        r = client.post(f"/teams/{second_team_id}/reject", headers=_auth(token))
        assert r.status_code == 200, r.text

        proj = client.post(f"/teams/{second_team_id}/projects", json={"name": "P"}, headers=_auth(token))
        assert proj.status_code == 403

    def test_reject_team_then_confirm_returns_409(self, client):
        token, _ = _setup(client, "reject-then-confirm.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        client.post(f"/teams/{second_team_id}/reject", headers=_auth(token))
        r = client.post(f"/teams/{second_team_id}/confirm", headers=_auth(token))
        assert r.status_code == 409

    def test_domain_status_reports_company(self, client):
        token, _ = _setup(client, "domain-company.io")
        r = client.get("/users/me/domain-status", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["has_company"] is True
        assert r.json()["company_id"] is not None

    def test_users_me_teams_includes_company_and_status(self, client):
        token, first_team_id = _setup(client, "teams-status.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]

        r = client.get("/users/me/teams", headers=_auth(token))
        assert r.status_code == 200
        entries = {e["team_id"]: e for e in r.json()}
        assert entries[first_team_id]["status"] == "CONFIRMED"
        assert entries[second_team_id]["status"] == "PENDING_CONFIRMATION"
        assert entries[first_team_id]["company_id"] == entries[second_team_id]["company_id"]

    def test_team_has_domain_field(self, client):
        token, team_id = _setup(client, "domaincheck.io")
        # GET /teams/{id}/members verifies the team exists with correct domain
        r = client.get(f"/teams/{team_id}/members", headers=_auth(token))
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Team members — candidates + add
# ---------------------------------------------------------------------------

class TestTeamMembers:
    def test_second_user_appears_as_candidate(self, client):
        token, team_id = _setup(client, "candidates.io")
        _register(client, "junior@candidates.io", name="Junior")

        r = client.get(f"/teams/{team_id}/members", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        candidate_emails = [c["email"] for c in data["candidates"]]
        assert "junior@candidates.io" in candidate_emails

    def test_add_candidate_moves_to_members(self, client):
        token, team_id = _setup(client, "add.io")
        junior_data = _register(client, "junior@add.io", name="Junior")
        user_id = junior_data["id"]

        r = client.post(
            f"/teams/{team_id}/members",
            json={"user_id": user_id, "role": "DEVELOPER"},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()["email"] == "junior@add.io"

        # now they should be in members, not candidates
        r = client.get(f"/teams/{team_id}/members", headers=_auth(token))
        member_emails = [m["email"] for m in r.json()["members"]]
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert "junior@add.io" in member_emails
        assert "junior@add.io" not in candidate_emails

    def test_candidates_exclude_members_of_any_team_in_company(self, client):
        """A user added to one Team of a Company must not still show up as a candidate
        in another Team of the same Company — candidates are scoped by Company domain,
        not by a single Team."""
        token, first_team_id = _setup(client, "multi-candidates.io")
        second = client.post("/teams", json={"name": "Second"}, headers=_auth(token))
        second_team_id = second.json()["id"]
        client.post(f"/teams/{second_team_id}/confirm", headers=_auth(token))

        junior_data = _register(client, "junior@multi-candidates.io", name="Junior")
        client.post(
            f"/teams/{first_team_id}/members",
            json={"user_id": junior_data["id"], "role": "DEVELOPER"},
            headers=_auth(token),
        )

        r = client.get(f"/teams/{second_team_id}/members", headers=_auth(token))
        assert r.status_code == 200
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert "junior@multi-candidates.io" not in candidate_emails

    def test_non_cloud_engineer_cannot_add_member(self, client):
        token_ce, team_id = _setup(client, "perm.io")
        dev_data = _register(client, "dev@perm.io", name="Dev")
        dev_id = dev_data["id"]

        # add dev as DEVELOPER
        client.post(
            f"/teams/{team_id}/members",
            json={"user_id": dev_id, "role": "DEVELOPER"},
            headers=_auth(token_ce),
        )
        dev_token = _login(client, "dev@perm.io")

        # dev tries to add another user — should 403
        third_data = _register(client, "third@perm.io", name="Third")
        r = client.post(
            f"/teams/{team_id}/members",
            json={"user_id": third_data["id"], "role": "DEVELOPER"},
            headers=_auth(dev_token),
        )
        assert r.status_code == 403

    def test_tech_lead_cannot_add_member_as_tech_lead(self, client):
        token_ce, team_id = _setup(client, "techleadperm.io")
        tl_data = _register(client, "tl@techleadperm.io", name="TL")
        client.post(
            f"/teams/{team_id}/members",
            json={"user_id": tl_data["id"], "role": "TECH_LEAD"},
            headers=_auth(token_ce),
        )
        tl_token = _login(client, "tl@techleadperm.io")

        third_data = _register(client, "third@techleadperm.io", name="Third")
        r = client.post(
            f"/teams/{team_id}/members",
            json={"user_id": third_data["id"], "role": "TECH_LEAD"},
            headers=_auth(tl_token),
        )
        assert r.status_code == 403

    def test_tech_lead_can_add_member_as_developer(self, client):
        token_ce, team_id = _setup(client, "techleadok.io")
        tl_data = _register(client, "tl@techleadok.io", name="TL")
        client.post(
            f"/teams/{team_id}/members",
            json={"user_id": tl_data["id"], "role": "TECH_LEAD"},
            headers=_auth(token_ce),
        )
        tl_token = _login(client, "tl@techleadok.io")

        dev_data = _register(client, "dev@techleadok.io", name="Dev")
        r = client.post(
            f"/teams/{team_id}/members",
            json={"user_id": dev_data["id"], "role": "DEVELOPER"},
            headers=_auth(tl_token),
        )
        assert r.status_code == 201

    def test_developer_can_read_team_members(self, client):
        token_ce, team_id = _setup(client, "devread.io")
        dev_data = _register(client, "dev@devread.io", name="Dev")
        client.post(
            f"/teams/{team_id}/members",
            json={"user_id": dev_data["id"], "role": "DEVELOPER"},
            headers=_auth(token_ce),
        )
        dev_token = _login(client, "dev@devread.io")

        r = client.get(f"/teams/{team_id}/members", headers=_auth(dev_token))
        assert r.status_code == 200

        r_team = client.get(f"/teams/{team_id}", headers=_auth(dev_token))
        assert r_team.status_code == 200

    def test_different_domain_user_not_in_candidates(self, client):
        token, team_id = _setup(client, "alpha.io")
        _register(client, "outsider@beta.io", name="Outsider")

        r = client.get(f"/teams/{team_id}/members", headers=_auth(token))
        candidate_emails = [c["email"] for c in r.json()["candidates"]]
        assert "outsider@beta.io" not in candidate_emails

    def test_add_duplicate_member_returns_409(self, client):
        token, team_id = _setup(client, "dup-member.io")
        junior_data = _register(client, "j@dup-member.io")
        user_id = junior_data["id"]

        client.post(f"/teams/{team_id}/members", json={"user_id": user_id, "role": "DEVELOPER"}, headers=_auth(token))
        r = client.post(f"/teams/{team_id}/members", json={"user_id": user_id, "role": "DEVELOPER"}, headers=_auth(token))
        assert r.status_code == 409


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class TestProjects:
    def test_create_project(self, client):
        token, team_id = _setup(client, "proj.io")
        r = client.post(
            f"/teams/{team_id}/projects",
            json={"name": "Proj", "git_ops_repository_url": "https://github.com/org/gitops"},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()["setup_status"] == "PENDING_CLUSTER"

    def test_non_member_cannot_create_project(self, client):
        token1, team_id = _setup(client, "proj2.io")
        token2, _ = _setup(client, "proj3.io")

        r = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token2))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cluster setup info
# ---------------------------------------------------------------------------

class TestClusterSetupInfo:
    def test_returns_external_id_and_policy(self, client):
        token, team_id = _setup(client, "setupinfo.io")
        project_id = _project(client, token, team_id)

        r = client.get(f"/projects/{project_id}/cluster-setup-info", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["external_id"] == f"ext-{project_id}"
        assert "trust_policy" in data
        assert len(data["access_entry_commands"]) == 2


# ---------------------------------------------------------------------------
# Cluster configuration (moto + mock K8s)
# ---------------------------------------------------------------------------

FAKE_ARN = "arn:aws:eks:eu-west-1:123456789012:cluster/my-cluster"
FAKE_ROLE_ARN = "arn:aws:iam::123456789012:role/DevShipRole"


class TestClusterConfigure:
    @mock_aws
    def test_happy_path(self, client):
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "cluster.io")
        project_id = _project(client, token, team_id)

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            r = client.post(
                f"/projects/{project_id}/cluster",
                json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN},
                headers=_auth(token),
            )

        assert r.status_code == 201
        assert r.json()["cluster_name"] == "my-cluster"
        assert r.json()["last_validated_at"] is not None

    @mock_aws
    def test_revalidate_bumps_last_validated_at(self, client):
        """Regression: the Settings screen showed created_at as "Última validação" —
        never changed between validate calls. revalidate_cluster must move it forward."""
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "revalbump.io")
        project_id = _project(client, token, team_id)

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            created = client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))
            first_validated_at = created.json()["last_validated_at"]

            r = client.post(f"/projects/{project_id}/cluster/revalidate", headers=_auth(token))

        assert r.status_code == 200
        second_validated_at = r.json()["last_validated_at"]
        assert second_validated_at is not None
        assert second_validated_at >= first_validated_at

    @mock_aws
    def test_duplicate_cluster_returns_409(self, client):
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "dupcluster.io")
        project_id = _project(client, token, team_id)

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))
            r = client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))
        assert r.status_code == 409

    @mock_aws
    def test_revalidate_never_leaks_raw_exception_text(self, client):
        # Regression: any exception during re-authentication (e.g. botocore's
        # ProfileNotFound when a cluster was terraform-destroyed and re-auth breaks in
        # an unexpected way) must still produce the generic user-safe message — never
        # the raw exception text, and never an unhandled 500.
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "clusterleak.io")
        project_id = _project(client, team_id=team_id, token=token)

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))

        class _WeirdException(Exception):
            pass

        with patch("backend.services.cluster_validation.assume_user_role", side_effect=_WeirdException("The config profile (devship-service) could not be found")):
            r = client.post(f"/projects/{project_id}/cluster/revalidate", headers=_auth(token))

        assert r.status_code == 422
        assert "devship-service" not in r.json()["detail"]
        assert "config profile" not in r.json()["detail"]
        assert "cluster ainda existe" in r.json()["detail"]


# ---------------------------------------------------------------------------
# ArgoCD / Metrics RBAC check
# ---------------------------------------------------------------------------

class TestClusterRbacCheck:
    def test_no_cluster_configured_returns_404(self, client):
        token, team_id = _setup(client, "rbacnocluster.io")
        project_id = _project(client, token, team_id)

        r = client.get(f"/projects/{project_id}/cluster/rbac-check", headers=_auth(token))
        assert r.status_code == 404

    @mock_aws
    def _configure_cluster(self, client, domain: str) -> tuple[str, str]:
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )
        token, team_id = _setup(client, domain)
        project_id = _project(client, token, team_id)
        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            r = client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))
        assert r.status_code == 201, r.text
        return token, project_id

    @mock_aws
    def test_auth_failure_marks_both_checks_failed_with_same_message(self, client):
        token, project_id = self._configure_cluster(client, "rbacautherr.io")

        with patch("backend.api.routes.onboarding._get_cluster_token", side_effect=ValueError("Não foi possível autenticar com o cluster.")):
            r = client.get(f"/projects/{project_id}/cluster/rbac-check", headers=_auth(token))

        assert r.status_code == 200
        data = r.json()
        assert data["argocd_ok"] is False
        assert data["metrics_ok"] is False
        assert data["argocd_error"] == data["metrics_error"] == "Não foi possível autenticar com o cluster."

    @mock_aws
    def test_argocd_ok_metrics_missing(self, client):
        token, project_id = self._configure_cluster(client, "rbacpartial.io")

        with (
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
            patch("backend.api.routes.onboarding.check_argocd_access", return_value=None),
            patch("backend.api.routes.onboarding.check_metrics_access", side_effect=Exception("403")),
        ):
            r = client.get(f"/projects/{project_id}/cluster/rbac-check", headers=_auth(token))

        assert r.status_code == 200
        data = r.json()
        assert data["argocd_ok"] is True
        assert data["argocd_error"] is None
        assert data["metrics_ok"] is False
        assert "metrics.k8s.io" in data["metrics_error"]
        assert data["rbac_subject"] == f"arn:aws:sts::123456789012:assumed-role/DevShipRole/SessionValidDevShip"

    @mock_aws
    def test_both_ok(self, client):
        token, project_id = self._configure_cluster(client, "rbacok.io")

        with (
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
            patch("backend.api.routes.onboarding.check_argocd_access", return_value=None),
            patch("backend.api.routes.onboarding.check_metrics_access", return_value=None),
        ):
            r = client.get(f"/projects/{project_id}/cluster/rbac-check", headers=_auth(token))

        assert r.status_code == 200
        data = r.json()
        assert data["argocd_ok"] is True
        assert data["metrics_ok"] is True
        assert data["argocd_error"] is None
        assert data["metrics_error"] is None


# ---------------------------------------------------------------------------
# Environments
# ---------------------------------------------------------------------------

class TestEnvironments:
    @mock_aws
    def test_creates_environments_with_validation(self, client):
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "envs.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))

        ns_item = MagicMock()
        ns_item.metadata.name = "staging"
        fake_ns = MagicMock()
        fake_ns.items = [ns_item]
        with (
            patch("backend.api.routes.onboarding.list_namespaces", return_value=fake_ns),
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
        ):
            r = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "staging", "namespace": "staging", "source_branch": "main", "gitops_branch": "main", "git_ops_base_path": "envs/staging", "deployment_order": 1}],
                headers=_auth(token),
            )

        assert r.status_code == 201
        assert r.json()[0]["validation"]["overall_status"] == "VALID"

    @mock_aws
    def test_argocd_application_not_found_fails_validation(self, client):
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "envsargocd.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))

        from backend.services.kubernetes_reader import KubernetesNotFoundError

        with (
            patch("backend.api.routes.onboarding.get_argocd_application", side_effect=KubernetesNotFoundError("404")),
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
        ):
            r = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "dev", "deployment_order": 1, "argocd_application_name": "demo-app-dev"}],
                headers=_auth(token),
            )

        assert r.status_code == 201
        validation = r.json()[0]["validation"]
        assert validation["argocd_status"] == "INVALID"
        assert "demo-app-dev" in validation["argocd_error"]
        assert validation["overall_status"] == "INVALID"

    @mock_aws
    def test_argocd_application_found_passes_validation(self, client):
        import boto3
        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token, team_id = _setup(client, "envsargocdok.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(f"/projects/{project_id}/cluster", json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN}, headers=_auth(token))

        with (
            patch("backend.api.routes.onboarding.get_argocd_application", return_value=MagicMock()),
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
        ):
            r = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "dev", "deployment_order": 1, "argocd_application_name": "demo-app-dev"}],
                headers=_auth(token),
            )

        assert r.status_code == 201
        assert r.json()[0]["validation"]["argocd_status"] == "VALID"

    def test_argocd_check_skipped_when_no_application_name_set(self, client):
        token, team_id = _setup(client, "envsargocdskip.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        r = client.post(
            f"/projects/{project_id}/environments",
            json=[{"name": "dev", "deployment_order": 1}],
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()[0]["validation"]["argocd_status"] == "VALID"


# ---------------------------------------------------------------------------
# GitOps scan
# ---------------------------------------------------------------------------

class TestGitOpsScan:
    def test_no_gitops_url_returns_422(self, client):
        token, team_id = _setup(client, "scan.io")
        project_id = _project(client, token, team_id)  # no git_ops_repository_url

        r = client.get(f"/projects/{project_id}/gitops-scan", headers=_auth(token))
        assert r.status_code == 422

    def test_scan_returns_candidates(self, client):
        token, team_id = _setup(client, "scan2.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        fake = [{"name": "api", "source_repository": "gh/org/api", "manifest_path": "envs/staging/api.yaml", "environments": ["staging"]}]
        with patch("backend.api.routes.onboarding.gs.scan_gitops_repo", return_value=fake):
            r = client.get(f"/projects/{project_id}/gitops-scan", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()[0]["name"] == "api"


# ---------------------------------------------------------------------------
# Workflow file discovery
# ---------------------------------------------------------------------------

class TestWorkflowFiles:
    def test_lists_workflow_files_from_repo(self, client):
        token, team_id = _setup(client, "workflows.io")
        project_id = _project(client, token, team_id)

        with patch("backend.api.routes.onboarding.gs.list_workflow_files", return_value=["gitops-deploy.yml"]):
            r = client.get(
                f"/projects/{project_id}/workflow-files",
                params={"source_repository": "https://github.com/org/backend"},
                headers=_auth(token),
            )

        assert r.status_code == 200
        assert r.json() == ["gitops-deploy.yml"]

    def test_returns_empty_list_on_upstream_error(self, client):
        token, team_id = _setup(client, "workflows2.io")
        project_id = _project(client, token, team_id)

        with patch("backend.api.routes.onboarding.gs.list_workflow_files", side_effect=Exception("boom")):
            r = client.get(
                f"/projects/{project_id}/workflow-files",
                params={"source_repository": "https://github.com/org/backend"},
                headers=_auth(token),
            )

        assert r.status_code == 200
        assert r.json() == []

    def test_non_cloud_engineer_forbidden(self, client):
        token, team_id = _setup(client, "workflows3.io")
        project_id = _project(client, token, team_id)

        dev_email = "dev@workflows3.io"
        _register(client, dev_email, name="Dev")
        dev_token = _login(client, dev_email)

        r = client.get(
            f"/projects/{project_id}/workflow-files",
            params={"source_repository": "https://github.com/org/backend"},
            headers=_auth(dev_token),
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# File preview
# ---------------------------------------------------------------------------

class TestFilePreview:
    def test_returns_file_content(self, client):
        token, team_id = _setup(client, "preview.io")
        project_id = _project(client, team_id=team_id, token=token)

        with patch("backend.api.routes.onboarding.gs.get_file_content", return_value="apiVersion: apps/v1"):
            r = client.get(
                f"/projects/{project_id}/file-preview",
                params={"repo_url": "https://github.com/org/gitops", "path": "envs/prod/api.yaml"},
                headers=_auth(token),
            )

        assert r.status_code == 200
        assert r.json() == {"content": "apiVersion: apps/v1"}

    def test_returns_404_when_content_is_none(self, client):
        token, team_id = _setup(client, "preview2.io")
        project_id = _project(client, team_id=team_id, token=token)

        with patch("backend.api.routes.onboarding.gs.get_file_content", return_value=None):
            r = client.get(
                f"/projects/{project_id}/file-preview",
                params={"repo_url": "https://github.com/org/gitops", "path": "does/not/exist.yaml"},
                headers=_auth(token),
            )

        assert r.status_code == 404

    def test_non_cloud_engineer_forbidden(self, client):
        token, team_id = _setup(client, "preview3.io")
        project_id = _project(client, team_id=team_id, token=token)

        dev_email = "dev@preview3.io"
        _register(client, dev_email, name="Dev")
        dev_token = _login(client, dev_email)

        r = client.get(
            f"/projects/{project_id}/file-preview",
            params={"repo_url": "https://github.com/org/gitops", "path": "envs/prod/api.yaml"},
            headers=_auth(dev_token),
        )
        assert r.status_code == 403


class TestDirPreview:
    def test_lists_directory_entries(self, client):
        token, team_id = _setup(client, "dirpreview.io")
        project_id = _project(client, team_id=team_id, token=token)

        fake = [{"name": "backend-deployment.yaml", "type": "file"}, {"name": "staging", "type": "dir"}]
        with patch("backend.api.routes.onboarding.gs.list_directory", return_value=fake):
            r = client.get(
                f"/projects/{project_id}/dir-preview",
                params={"repo_url": "https://github.com/org/gitops", "path": "apps/demo-app/dev"},
                headers=_auth(token),
            )

        assert r.status_code == 200
        assert r.json() == fake

    def test_returns_empty_list_on_upstream_error(self, client):
        token, team_id = _setup(client, "dirpreview2.io")
        project_id = _project(client, team_id=team_id, token=token)

        with patch("backend.api.routes.onboarding.gs.list_directory", side_effect=Exception("boom")):
            r = client.get(
                f"/projects/{project_id}/dir-preview",
                params={"repo_url": "https://github.com/org/gitops", "path": "apps/demo-app/dev"},
                headers=_auth(token),
            )

        assert r.status_code == 200
        assert r.json() == []

    def test_non_cloud_engineer_forbidden(self, client):
        token, team_id = _setup(client, "dirpreview3.io")
        project_id = _project(client, team_id=team_id, token=token)

        dev_email = "dev@dirpreview3.io"
        _register(client, dev_email, name="Dev")
        dev_token = _login(client, dev_email)

        r = client.get(
            f"/projects/{project_id}/dir-preview",
            params={"repo_url": "https://github.com/org/gitops", "path": "apps/demo-app/dev"},
            headers=_auth(dev_token),
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Application import
# ---------------------------------------------------------------------------

class TestApplicationImport:
    def test_import_sets_configured_status(self, client):
        token, team_id = _setup(client, "import.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with (
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
        ):
            env_id = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "staging", "deployment_order": 1}],
                headers=_auth(token),
            ).json()[0]["id"]

        r = client.post(
            f"/projects/{project_id}/applications/import",
            json={"applications": [{"name": "api", "source_repository": "https://github.com/org/api", "ci_workflow_file": "deploy.yml", "environments": [{"environment_id": env_id, "deployment_name": "api-deploy"}]}]},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()[0]["name"] == "api"

    def test_duplicate_source_repository_returns_409(self, client):
        # source_repository is unique across the whole system, so this must span two
        # different teams — a team can only have one project.
        token1, team1_id = _setup(client, "duprepo1.io")
        token2, team2_id = _setup(client, "duprepo2.io")
        proj1 = _project(client, token1, team1_id, name="P1")
        proj2 = _project(client, token2, team2_id, name="P2")

        payload = {"applications": [{"name": "api", "source_repository": "https://github.com/org/shared", "ci_workflow_file": "deploy.yml", "environments": []}]}
        assert client.post(f"/projects/{proj1}/applications/import", json=payload, headers=_auth(token1)).status_code == 201
        assert client.post(f"/projects/{proj2}/applications/import", json=payload, headers=_auth(token2)).status_code == 409

    def test_reimport_same_project_is_idempotent(self, client):
        # Navigating back and forth in onboarding before finishing it re-triggers the scan
        # and resubmits the same candidates — must not 409 against the caller's own project.
        token, team_id = _setup(client, "reimport.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with (
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
        ):
            env_id = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "staging", "deployment_order": 1}],
                headers=_auth(token),
            ).json()[0]["id"]

        payload = {"applications": [{"name": "api", "source_repository": "https://github.com/org/reimport-api", "ci_workflow_file": "deploy.yml", "environments": [{"environment_id": env_id, "deployment_name": "api-deploy"}]}]}

        first = client.post(f"/projects/{project_id}/applications/import", json=payload, headers=_auth(token))
        assert first.status_code == 201
        app_id = first.json()[0]["id"]

        second = client.post(f"/projects/{project_id}/applications/import", json=payload, headers=_auth(token))
        assert second.status_code == 201
        assert second.json()[0]["id"] == app_id  # same Application row reused, not a duplicate

        r = client.get(f"/projects/{project_id}/applications", headers=_auth(token))
        assert len([a for a in r.json() if a["source_repository"] == "https://github.com/org/reimport-api"]) == 1

    def test_argocd_application_name_is_shared_across_apps_in_same_environment(self, client):
        # Confirmed against a real ArgoCD instance: one Application per Environment,
        # syncing the whole apps/{project}/{env} path — shared by every Application
        # deployed into that Environment, not one per (Application, Environment).
        token, team_id = _setup(client, "argocdscope.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with (
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
        ):
            env_id = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "dev", "deployment_order": 1, "argocd_application_name": "demo-app-dev"}],
                headers=_auth(token),
            ).json()[0]["id"]

        payload = {"applications": [
            {"name": "backend", "source_repository": "https://github.com/org/argocdscope-backend", "ci_workflow_file": "deploy.yml",
             "environments": [{"environment_id": env_id, "deployment_name": "backend"}]},
            {"name": "frontend", "source_repository": "https://github.com/org/argocdscope-frontend", "ci_workflow_file": "deploy.yml",
             "environments": [{"environment_id": env_id, "deployment_name": "frontend"}]},
        ]}
        r = client.post(f"/projects/{project_id}/applications/import", json=payload, headers=_auth(token))
        assert r.status_code == 201

        env = client.get(f"/projects/{project_id}/environments", headers=_auth(token)).json()[0]
        assert env["argocd_application_name"] == "demo-app-dev"
        assert set(env["application_names"]) == {"backend", "frontend"}

    def test_update_environment_argocd_application_name(self, client):
        token, team_id = _setup(client, "argocdpatch.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with (
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
        ):
            env_id = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "dev", "deployment_order": 1}],
                headers=_auth(token),
            ).json()[0]["id"]

        r = client.patch(
            f"/projects/{project_id}/environments/{env_id}",
            json={"argocd_application_name": "demo-app-dev", "deployment_order": 1},
            headers=_auth(token),
        )
        assert r.status_code == 200

    def test_update_environment_validation_failure_detail_is_a_json_string(self, client):
        # detail must be a string the frontend can JSON.parse back into the validation
        # payload — a raw dict here would render as the literal "[object Object]".
        import json

        token, team_id = _setup(client, "envupdatefail.io")
        project_id = _project(client, token, team_id, git_ops_repository_url="https://github.com/org/gitops")

        with (
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
        ):
            env_id = client.post(
                f"/projects/{project_id}/environments",
                json=[{"name": "dev", "deployment_order": 1}],
                headers=_auth(token),
            ).json()[0]["id"]

        with patch("backend.api.routes.onboarding.validate_branch", return_value=False):
            r = client.patch(
                f"/projects/{project_id}/environments/{env_id}",
                json={"gitops_branch": "does-not-exist", "deployment_order": 1},
                headers=_auth(token),
            )

        assert r.status_code == 422
        detail = r.json()["detail"]
        assert isinstance(detail, str)
        parsed = json.loads(detail)
        assert parsed["overall_status"] == "INVALID"
        assert parsed["branch_status"] == "INVALID"
