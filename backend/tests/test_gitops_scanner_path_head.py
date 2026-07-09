"""Unit tests for resolve_path_head — no DB needed."""

from unittest.mock import MagicMock, patch

from backend.services.gitops_scanner import resolve_path_head


def test_resolve_path_head_no_commits_returns_none():
    resp = MagicMock()
    resp.json.return_value = []
    resp.raise_for_status.return_value = None
    with patch("backend.services.gitops_scanner.requests.get", return_value=resp):
        assert resolve_path_head("https://github.com/org/gitops", "main", "envs/dev/never-touched.yaml") is None


def test_resolve_path_head_returns_latest_sha_for_path():
    resp = MagicMock()
    resp.json.return_value = [{"sha": "manifest-sha-1"}]
    resp.raise_for_status.return_value = None
    with patch("backend.services.gitops_scanner.requests.get", return_value=resp) as mock_get:
        sha = resolve_path_head("https://github.com/org/gitops", "main", "envs/dev/api.yaml")
    assert sha == "manifest-sha-1"
    assert mock_get.call_args.kwargs["params"]["path"] == "envs/dev/api.yaml"


def test_resolve_path_head_returns_none_on_failure():
    with patch("backend.services.gitops_scanner.requests.get", side_effect=Exception("network")):
        assert resolve_path_head("https://github.com/org/gitops", "main", "envs/dev/api.yaml") is None
