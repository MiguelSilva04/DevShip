"""
Reads a GitOps repo via GitHub REST API.
Filters manifests with kind: Deployment and returns candidate applications.
"""

import os
import re
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


def _scan_path(owner: str, repo: str, env_name: str, path: str, headers: dict, candidates: list[dict]) -> None:
    """Scan a single directory path for Deployment manifests and merge into candidates."""
    path = path.strip("/")
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/{path}",
        headers=headers,
        timeout=15,
    )
    if not resp.ok:
        return

    for file_entry in resp.json():
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
            source_repo = doc.get("metadata", {}).get("annotations", {}).get("devship/source-repository", "")
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


def scan_gitops_repo(repo_url: str, env_paths: list[tuple[str, str]] | None = None) -> list[dict]:
    """
    Returns a list of dicts: {name, source_repository, manifest_path, environments}

    env_paths: list of (env_name, git_ops_base_path) from configured environments.
    If omitted, falls back to scanning root-level subdirs as environment names (legacy).
    Raises ValueError on GitHub API errors.
    """
    owner, repo = _parse_owner_repo(repo_url)
    headers = _github_headers()
    candidates: list[dict] = []

    if env_paths:
        for env_name, base_path in env_paths:
            _scan_path(owner, repo, env_name, base_path, headers, candidates)
        return candidates

    # Legacy fallback: treat subdirs of repo root as environment names
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/",
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 404:
        raise ValueError(f"GitOps repository not found: {repo_url}")
    resp.raise_for_status()

    for entry in resp.json():
        if entry["type"] != "dir":
            continue
        _scan_path(owner, repo, entry["name"], entry["path"], headers, candidates)

    return candidates


def repo_exists(repo_url: str) -> bool:
    owner, repo = _parse_owner_repo(repo_url)
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}",
        headers=_github_headers(),
        timeout=10,
    )
    return resp.status_code == 200


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


def resolve_branch_head(repo_url: str, branch: str) -> str | None:
    """Current HEAD commit SHA for a branch. Returns None on any failure (network,
    rate limit, unknown repo/branch) — callers must not treat None as a real mismatch."""
    owner, repo = _parse_owner_repo(repo_url)
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}",
            headers=_github_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["sha"]
    except Exception:
        return None


def is_repo_collaborator(repo_url: str, username: str) -> bool:
    """GET /repos/{owner}/{repo}/collaborators/{username} — 204 = sim, 404 = não."""
    owner, repo = _parse_owner_repo(repo_url)
    resp = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/collaborators/{username}",
        headers=_github_headers(),
        timeout=10,
    )
    return resp.status_code == 204


def get_branch_head_commit(repo_url: str, branch: str) -> dict | None:
    """{'sha': ..., 'author_email': ...} do commit HEAD, ou None em qualquer falha."""
    owner, repo = _parse_owner_repo(repo_url)
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}",
            headers=_github_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"sha": data["sha"], "author_email": data["commit"]["author"]["email"]}
    except Exception:
        return None


_CONVENTIONAL_COMMIT_RE = re.compile(r"^(\w+)(\(.+\))?!?:\s*(.+)$")


def compare_commits(repo_url: str, base_sha: str, head_ref: str) -> list[dict] | None:
    """GET /repos/{owner}/{repo}/compare/{base}...{head} — commits em head_ref que ainda
    não estão em base_sha, mais recente primeiro. None em qualquer falha (repo/branch
    inacessível, base_sha desconhecido do GitHub, etc.) — nunca uma lista vazia por engano.
    """
    owner, repo = _parse_owner_repo(repo_url)
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/compare/{base_sha}...{head_ref}",
            headers=_github_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    commits = []
    for c in reversed(data.get("commits", [])):
        message = c["commit"]["message"].splitlines()[0]
        m = _CONVENTIONAL_COMMIT_RE.match(message)
        commit_type = m.group(1) if m else None
        subject = m.group(3) if m else message
        commits.append({
            "sha": c["sha"],
            "type": commit_type,
            "message": subject,
            "author": c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
        })
    return commits
