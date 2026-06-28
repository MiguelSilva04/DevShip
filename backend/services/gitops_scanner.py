"""
Reads a GitOps repo via GitHub REST API.
Filters manifests with kind: Deployment and returns candidate applications.
"""

import os
from typing import Any

import requests
import yaml


def _github_headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_owner_repo(repo_url: str) -> tuple[str, str]:
    """Extract owner/repo from https://github.com/owner/repo or git@github.com:owner/repo."""
    url = repo_url.rstrip("/").removesuffix(".git")
    parts = url.replace(":", "/").split("/")
    return parts[-2], parts[-1]


def scan_gitops_repo(repo_url: str, base_path: str = "") -> list[dict]:
    """
    Returns a list of dicts: {name, source_repository, manifest_path, environments}
    Environments are inferred from directory names one level below base_path.
    Raises ValueError on GitHub API errors.
    """
    owner, repo = _parse_owner_repo(repo_url)
    headers = _github_headers()

    path = base_path.strip("/")
    contents_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    resp = requests.get(contents_url, headers=headers, timeout=15)
    if resp.status_code == 404:
        raise ValueError(f"GitOps path not found: {repo_url}/{base_path}")
    resp.raise_for_status()

    candidates = []
    for entry in resp.json():
        if entry["type"] != "dir":
            continue
        env_name = entry["name"]
        env_path = entry["path"]

        # List YAML files in this environment dir
        files_resp = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{env_path}",
            headers=headers,
            timeout=15,
        )
        if not files_resp.ok:
            continue

        for file_entry in files_resp.json():
            if file_entry["type"] != "file" or not file_entry["name"].endswith((".yaml", ".yml")):
                continue

            content_resp = requests.get(file_entry["download_url"], timeout=15)
            if not content_resp.ok:
                continue

            docs = list(yaml.safe_load_all(content_resp.text))
            for doc in docs:
                if not isinstance(doc, dict) or doc.get("kind") != "Deployment":
                    continue
                app_name = doc.get("metadata", {}).get("name", file_entry["name"])
                source_repo = (
                    doc.get("metadata", {}).get("annotations", {}).get("devship/source-repository", "")
                )
                # Merge with existing candidate for same app name
                existing = next((c for c in candidates if c["name"] == app_name), None)
                if existing:
                    if env_name not in existing["environments"]:
                        existing["environments"].append(env_name)
                else:
                    candidates.append({
                        "name": app_name,
                        "source_repository": source_repo,
                        "manifest_path": file_entry["path"],
                        "environments": [env_name],
                    })

    return candidates


def validate_branch(repo_url: str, branch: str) -> bool:
    owner, repo = _parse_owner_repo(repo_url)
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}",
        headers=_github_headers(),
        timeout=10,
    )
    return resp.status_code == 200


def path_exists(repo_url: str, path: str, branch: str = "main") -> bool:
    owner, repo = _parse_owner_repo(repo_url)
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}",
        headers=_github_headers(),
        timeout=10,
    )
    return resp.status_code == 200
