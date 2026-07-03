"""
Deploy pipeline orchestration.

trigger_deploy()  — called in the request thread; dispatches GitHub workflow, commits run_id.
observe_deployment() — called as a BackgroundTask; opens its own DB session (the request
                       session is already closed by the time this runs).
"""
import os
import time
import uuid
from datetime import datetime, timezone

import requests as http

from backend.bd.models.application import Application
from backend.bd.models.application_environment import ApplicationEnvironment
from backend.bd.models.cluster_context import ClusterContext
from backend.bd.models.deployment_event import DeploymentEvent, DeploymentEventType, EventSource, Severity
from backend.bd.models.deployment_request import DeploymentRequest, RequestStatus
from backend.bd.models.deployment_version import DeploymentVersion, TriggerSource
from backend.bd.models.environment import Environment
from backend.bd.session import SessionLocal
from backend.services.cluster_validation import get_cluster_token
from backend.services.kubernetes_reader import get_argocd_application, list_deployment, list_pods_in_namespace

_SEVERITY = {
    DeploymentEventType.WORKFLOW_STARTED: Severity.INFO,
    DeploymentEventType.BUILD_COMPLETED: Severity.INFO,
    DeploymentEventType.IMAGE_PUSHED: Severity.INFO,
    DeploymentEventType.GITOPS_UPDATED: Severity.INFO,
    DeploymentEventType.SYNC_STARTED: Severity.INFO,
    DeploymentEventType.SYNC_COMPLETED: Severity.INFO,
    DeploymentEventType.ROLLOUT_STARTED: Severity.INFO,
    DeploymentEventType.ROLLOUT_COMPLETED: Severity.INFO,
    DeploymentEventType.POD_CREATED: Severity.INFO,
    DeploymentEventType.READINESS_PASSED: Severity.INFO,
    DeploymentEventType.IMAGE_BUILD_FAILED: Severity.ERROR,
    DeploymentEventType.SYNC_FAILED: Severity.ERROR,
    DeploymentEventType.READINESS_FAILED: Severity.ERROR,
    DeploymentEventType.CRASH_LOOP_BACKOFF: Severity.ERROR,
}

_POLL_INTERVAL = 3      # seconds between polls
_TIMEOUT = 15 * 60      # 15 minutes


def _github_headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN", "")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _parse_github_repo(source_repository: str) -> tuple[str, str]:
    """Extract owner/repo from https://github.com/owner/repo or git@github.com:owner/repo."""
    url = source_repository.rstrip("/")
    if url.startswith("git@github.com:"):
        path = url.split("git@github.com:", 1)[1]
    else:
        path = url.split("github.com/", 1)[-1]
    parts = path.rstrip(".git").split("/")
    return parts[0], parts[1]


def _resolve_branch_head(owner: str, repo: str, branch: str) -> str | None:
    try:
        r = http.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}",
            headers=_github_headers(),
            timeout=10,
        )
        r.raise_for_status()
        return r.json()["sha"]
    except Exception:
        return None


def trigger_deploy(db, request: DeploymentRequest, environment: Environment, application: Application) -> None:
    """Resolve HEAD SHA (audit), dispatch workflow, persist run_id. Commits."""
    owner, repo = _parse_github_repo(application.source_repository)

    request.source_commit_sha = _resolve_branch_head(owner, repo, environment.source_branch or "main")

    workflow_file = application.ci_workflow_file.removeprefix(".github/workflows/")
    response = http.post(
        f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches",
        headers=_github_headers(),
        json={
            "ref": environment.source_branch or "main",
            "inputs": {"environment": environment.name.lower(), "action": "deploy"},
            "return_run_details": True,
        },
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    request.github_workflow_run_id = data.get("workflow_run_id") or data.get("id")
    request.status = RequestStatus.RUNNING
    db.commit()


def _emit_event(db, version: DeploymentVersion, event_type: DeploymentEventType, source: EventSource, message: str = None) -> None:
    db.add(DeploymentEvent(
        deployment_version_id=version.id,
        event_type=event_type,
        source=source,
        severity=_SEVERITY[event_type],
        message=message,
        event_timestamp=datetime.now(timezone.utc),
    ))
    db.commit()


def observe_deployment(deployment_request_id: uuid.UUID) -> None:
    """
    BackgroundTask entry point. Opens its own SessionLocal — the request session is gone.
    Polls GitHub → ArgoCD → K8s Deployment → K8s Pods in sequence.
    Timeout: 15 min. On any terminal failure: marks request FAILED, returns.
    """
    db = SessionLocal()
    try:
        req = db.get(DeploymentRequest, deployment_request_id)
        if req is None:
            return

        app_env = db.get(ApplicationEnvironment, req.application_environment_id)
        env = db.get(Environment, app_env.environment_id)
        app = db.get(Application, app_env.application_id)

        cluster_ctx = db.query(ClusterContext).filter(ClusterContext.project_id == env.project_id).first()

        # Create the DeploymentVersion now (lifecycle_status=Deploying by default, DEV-10 owns the rest)
        version = DeploymentVersion(
            application_environment_id=app_env.id,
            deployment_request_id=req.id,
            trigger_source=TriggerSource.DEVSHIP,
        )
        db.add(version)
        db.commit()

        deadline = time.monotonic() + _TIMEOUT
        owner, repo = _parse_github_repo(app.source_repository)

        # ── 1. Wait for GitHub Actions run to complete ────────────────────────
        _emit_event(db, version, DeploymentEventType.WORKFLOW_STARTED, EventSource.GITHUB)

        run_id = req.github_workflow_run_id
        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                r = http.get(
                    f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}",
                    headers=_github_headers(), timeout=10,
                )
                r.raise_for_status()
                run = r.json()
                if run["status"] == "completed":
                    if run["conclusion"] == "success":
                        # Extract image tag from run name or just use SHA
                        head_sha = run.get("head_sha", "")
                        run_number = run.get("run_number")
                        version.image_tag = f"{head_sha[:7]}-{run_number}" if head_sha and run_number else None
                        version.source_commit_sha = head_sha
                        db.commit()
                        _emit_event(db, version, DeploymentEventType.BUILD_COMPLETED, EventSource.GITHUB)
                        _emit_event(db, version, DeploymentEventType.IMAGE_PUSHED, EventSource.GITHUB)
                        break
                    else:
                        _emit_event(db, version, DeploymentEventType.IMAGE_BUILD_FAILED, EventSource.GITHUB,
                                    message=f"Run {run_id} concluded: {run['conclusion']}")
                        _fail_request(db, req, f"GitHub Actions run {run_id} failed: {run['conclusion']}")
                        return
            except Exception as e:
                _emit_event(db, version, DeploymentEventType.IMAGE_BUILD_FAILED, EventSource.GITHUB, message=str(e))
                _fail_request(db, req, str(e))
                return
        else:
            _timeout(db, req)
            return

        if cluster_ctx is None:
            # No cluster configured — can't observe K8s/ArgoCD, mark success as far as we can tell
            req.status = RequestStatus.SUCCESS
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        eks_info = get_cluster_token(
            iam_role_arn=cluster_ctx.iam_role_arn,
            external_id=cluster_ctx.external_id,
            cluster_arn=cluster_ctx.cluster_arn,
        )

        # ── 2. ArgoCD sync ────────────────────────────────────────────────────
        argocd_app_name = f"{app.name}-{env.name}"
        sync_phase_seen = set()

        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                argocd_app = get_argocd_application(eks_info, argocd_app_name)
                phase = argocd_app.status.operation_phase

                if phase == "Running" and "Running" not in sync_phase_seen:
                    sync_phase_seen.add("Running")
                    _emit_event(db, version, DeploymentEventType.SYNC_STARTED, EventSource.ARGOCD)
                    version.argocd_sync_revision = argocd_app.status.sync_revision
                    db.commit()

                if phase == "Succeeded" and "Succeeded" not in sync_phase_seen:
                    sync_phase_seen.add("Succeeded")
                    _emit_event(db, version, DeploymentEventType.SYNC_COMPLETED, EventSource.ARGOCD)
                    _emit_event(db, version, DeploymentEventType.GITOPS_UPDATED, EventSource.ARGOCD)
                    break

                if phase in ("Failed", "Error"):
                    _emit_event(db, version, DeploymentEventType.SYNC_FAILED, EventSource.ARGOCD,
                                message=f"ArgoCD sync phase: {phase}")
                    _fail_request(db, req, f"ArgoCD sync failed: {phase}")
                    return
            except Exception as e:
                # ArgoCD Application may not exist yet — keep waiting until timeout
                pass
        else:
            _timeout(db, req)
            return

        # ── 3. K8s Deployment rollout ─────────────────────────────────────────
        namespace = env.namespace or env.name
        deployment_name = app_env.deployment_name
        rollout_started = False
        rollout_done = False

        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                dep = list_deployment(eks_info, namespace, deployment_name)
                for c in dep.status.conditions:
                    if c.type == "Progressing":
                        if not rollout_started and c.reason == "ReplicaSetUpdated":
                            rollout_started = True
                            _emit_event(db, version, DeploymentEventType.ROLLOUT_STARTED, EventSource.KUBERNETES)
                        if not rollout_done and c.reason == "NewReplicaSetAvailable":
                            rollout_done = True
                            _emit_event(db, version, DeploymentEventType.ROLLOUT_COMPLETED, EventSource.KUBERNETES)
                if rollout_done:
                    break
            except Exception:
                pass
        else:
            _timeout(db, req)
            return

        # ── 4 + 5. Pod readiness + CrashLoopBackOff ──────────────────────────
        known_pods: set[str] = set()
        ready_seen = False
        crash_seen = False

        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                pod_list = list_pods_in_namespace(eks_info, namespace)
                for pod in pod_list.items:
                    pod_name = pod.metadata.name
                    if pod_name not in known_pods:
                        known_pods.add(pod_name)
                        _emit_event(db, version, DeploymentEventType.POD_CREATED, EventSource.KUBERNETES,
                                    message=pod_name)

                # Re-fetch with full detail for ready/crash checks via raw API
                raw = http.get(
                    f"{eks_info.endpoint}/api/v1/namespaces/{namespace}/pods",
                    headers={"Authorization": f"Bearer {eks_info.bearer_token}", "x-k8s-aws-id": eks_info.name},
                    verify=eks_info.ca_file_path, timeout=10,
                ).json()

                for item in raw.get("items", []):
                    # CrashLoopBackOff
                    for cs in item.get("status", {}).get("containerStatuses", []):
                        waiting = (cs.get("state") or {}).get("waiting") or {}
                        if not crash_seen and waiting.get("reason") == "CrashLoopBackOff":
                            crash_seen = True
                            _emit_event(db, version, DeploymentEventType.CRASH_LOOP_BACKOFF, EventSource.KUBERNETES,
                                        message=item["metadata"]["name"])
                            _fail_request(db, req, "CrashLoopBackOff detected")
                            return

                    # Ready condition
                    for cond in item.get("status", {}).get("conditions", []):
                        if cond.get("type") == "Ready":
                            if cond.get("status") == "True" and not ready_seen:
                                ready_seen = True
                                _emit_event(db, version, DeploymentEventType.READINESS_PASSED, EventSource.KUBERNETES,
                                            message=item["metadata"]["name"])
                            elif cond.get("status") == "False" and ready_seen:
                                _emit_event(db, version, DeploymentEventType.READINESS_FAILED, EventSource.KUBERNETES,
                                            message=item["metadata"]["name"])
                                _fail_request(db, req, "Pod readiness lost after passing")
                                return

                if ready_seen:
                    break
            except Exception:
                pass
        else:
            _timeout(db, req)
            return

        # ── All stages passed → SUCCESS ───────────────────────────────────────
        req.status = RequestStatus.SUCCESS
        req.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        try:
            db.rollback()  # clear any aborted transaction before trying to write FAILED
            req = db.get(DeploymentRequest, deployment_request_id)
            if req and req.status == RequestStatus.RUNNING:
                _fail_request(db, req, f"Unexpected error in observer: {e}")
        except Exception:
            pass
    finally:
        db.close()


def _fail_request(db, req: DeploymentRequest, reason: str) -> None:
    req.status = RequestStatus.FAILED
    req.failure_reason = reason
    req.completed_at = datetime.now(timezone.utc)
    db.commit()


def _timeout(db, req: DeploymentRequest) -> None:
    _fail_request(db, req, "Timeout: pipeline did not reach a terminal state within 15 minutes")
