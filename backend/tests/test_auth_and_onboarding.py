"""
Happy path + main error cases for auth and onboarding endpoints.

AWS calls are mocked with moto; K8s list_namespaces is mocked with unittest.mock.
"""

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws
from sqlalchemy.orm import Session

# Set required env vars before importing the app
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", ""))

from backend.api.main import app
from backend.api.deps import get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client(db_session: Session):
    """TestClient with get_db overridden to use the test transaction session."""
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _register_and_login(client: TestClient, email: str = "eng@example.com") -> str:
    client.post("/auth/register", json={"name": "Eng", "email": email, "password": "pw123456"})
    resp = client.post("/auth/login", json={"email": email, "password": "pw123456"})
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TestAuth:
    def test_register_and_login(self, client):
        r = client.post("/auth/register", json={"name": "Alice", "email": "alice@x.com", "password": "secret"})
        assert r.status_code == 201
        assert r.json()["email"] == "alice@x.com"

        r = client.post("/auth/login", json={"email": "alice@x.com", "password": "secret"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_duplicate_email(self, client):
        body = {"name": "A", "email": "dup@x.com", "password": "pw"}
        client.post("/auth/register", json=body)
        r = client.post("/auth/register", json=body)
        assert r.status_code == 409

    def test_wrong_password(self, client):
        client.post("/auth/register", json={"name": "B", "email": "b@x.com", "password": "correct"})
        r = client.post("/auth/login", json={"email": "b@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_protected_endpoint_no_token(self, client):
        r = client.post("/teams", json={"name": "T"})
        assert r.status_code == 403  # HTTPBearer returns 403 when no creds


# ---------------------------------------------------------------------------
# Teams & Projects
# ---------------------------------------------------------------------------

class TestTeamsProjects:
    def test_create_team_and_project(self, client):
        token = _register_and_login(client)
        r = client.post("/teams", json={"name": "My Team"}, headers=_auth(token))
        assert r.status_code == 201
        team_id = r.json()["id"]

        r = client.post(
            f"/teams/{team_id}/projects",
            json={"name": "Proj", "git_ops_repository_url": "https://github.com/org/gitops"},
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()["setup_status"] == "PENDING_CLUSTER"
        assert r.json()["git_ops_repository_url"] == "https://github.com/org/gitops"

    def test_non_member_cannot_create_project(self, client):
        token1 = _register_and_login(client, "eng1@x.com")
        token2 = _register_and_login(client, "eng2@x.com")

        r = client.post("/teams", json={"name": "T"}, headers=_auth(token1))
        team_id = r.json()["id"]

        r = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token2))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cluster setup info
# ---------------------------------------------------------------------------

class TestClusterSetupInfo:
    def test_returns_external_id_and_policy(self, client):
        token = _register_and_login(client, "eng@setupinfo.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token)).json()
        project_id = project["id"]

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

        # Create the EKS cluster in moto
        eks = boto3.client("eks", region_name="eu-west-1")
        eks.create_cluster(
            name="my-cluster",
            version="1.29",
            roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token = _register_and_login(client, "eng@cluster.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project_id = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token)).json()["id"]

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            r = client.post(
                f"/projects/{project_id}/cluster",
                json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN},
                headers=_auth(token),
            )

        assert r.status_code == 201
        assert r.json()["cluster_name"] == "my-cluster"

        # SetupStatus should have advanced
        info = client.get(f"/projects/{project_id}/cluster-setup-info", headers=_auth(token))
        assert info.status_code == 200  # project still accessible

    @mock_aws
    def test_duplicate_cluster_returns_409(self, client):
        import boto3

        boto3.client("eks", region_name="eu-west-1").create_cluster(
            name="my-cluster", version="1.29", roleArn=FAKE_ROLE_ARN,
            resourcesVpcConfig={"subnetIds": ["subnet-abc"], "securityGroupIds": []},
        )

        token = _register_and_login(client, "eng@dup-cluster.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project_id = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token)).json()["id"]

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(
                f"/projects/{project_id}/cluster",
                json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN},
                headers=_auth(token),
            )
            r = client.post(
                f"/projects/{project_id}/cluster",
                json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN},
                headers=_auth(token),
            )
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

        token = _register_and_login(client, "eng@envs.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project_id = client.post(
            f"/teams/{team_id}/projects",
            json={"name": "P", "git_ops_repository_url": "https://github.com/org/gitops"},
            headers=_auth(token),
        ).json()["id"]

        with patch("backend.services.cluster_validation.list_namespaces", return_value=MagicMock(items=[])):
            client.post(
                f"/projects/{project_id}/cluster",
                json={"cluster_arn": FAKE_ARN, "iam_role_arn": FAKE_ROLE_ARN},
                headers=_auth(token),
            )

        fake_ns = MagicMock()
        fake_ns.items = [MagicMock(metadata=MagicMock(name="staging")), MagicMock(metadata=MagicMock(name="production"))]
        with (
            patch("backend.api.routes.onboarding.list_namespaces", return_value=fake_ns),
            patch("backend.api.routes.onboarding.validate_branch", return_value=True),
            patch("backend.api.routes.onboarding.path_exists", return_value=True),
            patch("backend.api.routes.onboarding._get_cluster_token", return_value=MagicMock()),
        ):
            r = client.post(
                f"/projects/{project_id}/environments",
                json=[
                    {
                        "name": "staging",
                        "namespace": "staging",
                        "source_branch": "main",
                        "git_ops_base_path": "envs/staging",
                        "deployment_order": 1,
                    }
                ],
                headers=_auth(token),
            )

        assert r.status_code == 201
        env = r.json()[0]
        assert env["name"] == "staging"
        assert env["validation"]["overall_status"] == "VALID"


# ---------------------------------------------------------------------------
# GitOps scan
# ---------------------------------------------------------------------------

class TestGitOpsScan:
    def test_no_gitops_url_returns_422(self, client):
        token = _register_and_login(client, "eng@scan.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        # No git_ops_repository_url
        project_id = client.post(f"/teams/{team_id}/projects", json={"name": "P"}, headers=_auth(token)).json()["id"]

        r = client.get(f"/projects/{project_id}/gitops-scan", headers=_auth(token))
        assert r.status_code == 422

    def test_scan_returns_candidates(self, client):
        token = _register_and_login(client, "eng@scan2.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project_id = client.post(
            f"/teams/{team_id}/projects",
            json={"name": "P", "git_ops_repository_url": "https://github.com/org/gitops"},
            headers=_auth(token),
        ).json()["id"]

        fake_candidates = [{"name": "api", "source_repository": "gh/org/api", "manifest_path": "envs/staging/api.yaml", "environments": ["staging"]}]
        with patch("backend.api.routes.onboarding.gs.scan_gitops_repo", return_value=fake_candidates):
            r = client.get(f"/projects/{project_id}/gitops-scan", headers=_auth(token))

        assert r.status_code == 200
        assert r.json()[0]["name"] == "api"


# ---------------------------------------------------------------------------
# Application import
# ---------------------------------------------------------------------------

class TestApplicationImport:
    def test_import_sets_configured_status(self, client):
        token = _register_and_login(client, "eng@import.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]
        project_id = client.post(
            f"/teams/{team_id}/projects",
            json={"name": "P", "git_ops_repository_url": "https://github.com/org/gitops"},
            headers=_auth(token),
        ).json()["id"]

        # Create an environment first (no external calls needed — no cluster)
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
            json={
                "applications": [
                    {
                        "name": "api",
                        "source_repository": "https://github.com/org/api",
                        "container_registry_repository": "ecr/org/api",
                        "environments": [{"environment_id": env_id, "deployment_name": "api-deploy"}],
                    }
                ]
            },
            headers=_auth(token),
        )
        assert r.status_code == 201
        assert r.json()[0]["name"] == "api"

    def test_duplicate_source_repository_returns_409(self, client):
        token = _register_and_login(client, "eng@dup-repo.com")
        team_id = client.post("/teams", json={"name": "T"}, headers=_auth(token)).json()["id"]

        proj1 = client.post(f"/teams/{team_id}/projects", json={"name": "P1"}, headers=_auth(token)).json()["id"]
        proj2 = client.post(f"/teams/{team_id}/projects", json={"name": "P2"}, headers=_auth(token)).json()["id"]

        payload = {
            "applications": [
                {
                    "name": "api",
                    "source_repository": "https://github.com/org/shared-repo",
                    "container_registry_repository": "ecr/org/api",
                    "environments": [],
                }
            ]
        }
        r1 = client.post(f"/projects/{proj1}/applications/import", json=payload, headers=_auth(token))
        assert r1.status_code == 201

        r2 = client.post(f"/projects/{proj2}/applications/import", json=payload, headers=_auth(token))
        assert r2.status_code == 409
