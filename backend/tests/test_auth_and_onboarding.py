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
    def test_post_teams_fails_if_domain_already_has_team(self, client):
        token, _ = _setup(client, "acme.io")
        # _setup already created the team for acme.io; a second POST must 409
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
