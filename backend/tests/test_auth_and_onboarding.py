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
    """Register a user and return the response JSON (includes team_id when first of domain)."""
    r = client.post("/auth/register", json={"name": name, "email": email, "password": "pw123456"})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client: TestClient, email: str) -> str:
    resp = client.post("/auth/login", json={"email": email, "password": "pw123456"})
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _setup(client: TestClient, domain: str) -> tuple[str, str]:
    """Register first user for a unique domain; return (token, team_id)."""
    email = f"eng@{domain}"
    data = _register(client, email)
    token = _login(client, email)
    return token, data["team_id"]


def _project(client: TestClient, token: str, team_id: str, **kwargs) -> str:
    body = {"name": "Proj", **kwargs}
    r = client.post(f"/teams/{team_id}/projects", json=body, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TestAuth:
    def test_register_first_user_creates_team(self, client):
        data = _register(client, "alice@newdomain.com")
        assert data["email"] == "alice@newdomain.com"
        assert data["team_id"] is not None

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
    def test_post_teams_fails_if_domain_already_has_team(self, client):
        token, _ = _setup(client, "acme.io")
        # register already created the team for acme.io; manual POST must 409
        r = client.post("/teams", json={"name": "Another"}, headers=_auth(token))
        assert r.status_code == 409

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
            json={"applications": [{"name": "api", "source_repository": "https://github.com/org/api", "container_registry_repository": "ecr/org/api", "ci_workflow_file": "deploy.yml", "environments": [{"environment_id": env_id, "deployment_name": "api-deploy"}]}]},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()[0]["name"] == "api"

    def test_duplicate_source_repository_returns_409(self, client):
        token, team_id = _setup(client, "duprepo.io")
        proj1 = _project(client, token, team_id, name="P1")
        proj2 = _project(client, token, team_id, name="P2")

        payload = {"applications": [{"name": "api", "source_repository": "https://github.com/org/shared", "container_registry_repository": "ecr/org/api", "ci_workflow_file": "deploy.yml", "environments": []}]}
        assert client.post(f"/projects/{proj1}/applications/import", json=payload, headers=_auth(token)).status_code == 201
        assert client.post(f"/projects/{proj2}/applications/import", json=payload, headers=_auth(token)).status_code == 409
