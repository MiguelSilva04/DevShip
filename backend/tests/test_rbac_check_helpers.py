"""Unit tests for the ArgoCD/Metrics RBAC check helpers — no DB needed."""

from unittest.mock import MagicMock, patch

import pytest

from backend.services.aws_auth import compute_rbac_subject
from backend.services.kubernetes_reader import check_argocd_access, check_metrics_access


def test_compute_rbac_subject_valid_arn():
    subject = compute_rbac_subject("arn:aws:iam::123456789012:role/DevShipRole")
    assert subject == "arn:aws:sts::123456789012:assumed-role/DevShipRole/SessionValidDevShip"


def test_compute_rbac_subject_malformed_arn_returns_none():
    assert compute_rbac_subject("not-an-arn") is None


def test_check_argocd_access_raises_on_403():
    cluster = MagicMock(endpoint="https://x", bearer_token="t", name="c", ca_file_path="/ca")
    with patch("backend.services.kubernetes_reader.api_request", side_effect=Exception("403")):
        with pytest.raises(Exception):
            check_argocd_access(cluster, "argocd")


def test_check_metrics_access_raises_on_403():
    cluster = MagicMock(endpoint="https://x", bearer_token="t", name="c", ca_file_path="/ca")
    with patch("backend.services.kubernetes_reader.api_request", side_effect=Exception("403")):
        with pytest.raises(Exception):
            check_metrics_access(cluster)
