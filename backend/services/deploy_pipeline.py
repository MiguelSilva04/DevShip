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
from backend.bd.models.deployment_request import DeploymentRequest, DeploymentType, RequestStatus
from backend.bd.models.deployment_version import DeploymentVersion, LifecycleStatus, TriggerSource
from backend.bd.models.environment import Environment
from backend.bd.session import SessionLocal
from backend.services.cluster_validation import get_cluster_token
from backend.services.gitops_scanner import resolve_branch_head as _resolve_branch_head
from backend.services.kubernetes_reader import KubernetesNotFoundError, get_argocd_application, list_deployment, list_pods_in_namespace

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


def trigger_deploy(db, request: DeploymentRequest, environment: Environment, application: Application) -> None:
    """Resolve HEAD SHA (audit), dispatch workflow, persist run_id. Commits.
    For ROLLBACK requests, dispatches with action=rollback + rollback_tag instead of
    action=deploy — the workflow skips build/push and reuses the target version's image."""
    owner, repo = _parse_github_repo(application.source_repository)

    if request.deployment_type == DeploymentType.ROLLBACK:
        target = db.get(DeploymentVersion, request.rollback_target_version_id)
        # A ROLLBACK doesn't build from the branch's current HEAD — it reuses the target's
        # image, so source_commit_sha must reflect the target's commit, not the current HEAD.
        # Recording the branch HEAD here made the Execution screen show the commit being
        # rolled back FROM instead of the one rolled back TO.
        request.source_commit_sha = target.source_commit_sha
        inputs = {
            "environment": environment.name.lower(),
            "action": "rollback",
            "rollback_tag": target.image_tag,
        }
    else:
        request.source_commit_sha = _resolve_branch_head(application.source_repository, environment.source_branch or "main")
        inputs = {"environment": environment.name.lower(), "action": "deploy"}

    workflow_file = application.ci_workflow_file.removeprefix(".github/workflows/")
    response = http.post(
        f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches",
        headers=_github_headers(),
        json={
            "ref": environment.source_branch or "main",
            "inputs": inputs,
            "return_run_details": True,
        },
        timeout=15,
    )
    response.raise_for_status()
    # workflow_dispatch returns 204 No Content — resolve the run_id by polling for the newest run
    request.github_workflow_run_id = _resolve_run_id(owner, repo, workflow_file, environment.source_branch or "main")
    request.status = RequestStatus.RUNNING
    db.commit()


def _resolve_run_id(owner: str, repo: str, workflow_file: str, branch: str) -> int | None:
    """Poll until GitHub registers the new workflow run (usually < 5s after dispatch)."""
    for _ in range(10):
        time.sleep(2)
        try:
            r = http.get(
                f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file}/runs",
                headers=_github_headers(),
                params={"branch": branch, "per_page": 1},
                timeout=10,
            )
            r.raise_for_status()
            runs = r.json().get("workflow_runs", [])
            if runs:
                return runs[0]["id"]
        except Exception:
            pass
    return None


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


_ARGOCD_MAX_MISSES = 20   # ~60s of consecutive failures before giving up on ArgoCD
_FATAL_POD_REASONS = {"CrashLoopBackOff", "ErrImagePull", "ImagePullBackOff", "OOMKilled", "Error"}


def observe_deployment(deployment_request_id: uuid.UUID) -> None:
    """
    BackgroundTask entry point. Opens its own SessionLocal.
    Phases: GitHub CI → (ArgoCD sync, optional) → K8s rollout → Pod readiness.
    ArgoCD is treated as optional: if unreachable for _ARGOCD_MAX_MISSES polls,
    we skip to K8s observation and emit GITOPS_UPDATED as a best-effort event.
    All errors are emitted as events so the UI shows what went wrong.
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

        version = DeploymentVersion(
            application_environment_id=app_env.id,
            deployment_request_id=req.id,
            trigger_source=TriggerSource.DEVSHIP,
        )
        db.add(version)
        db.commit()

        deadline = time.monotonic() + _TIMEOUT
        owner, repo = _parse_github_repo(app.source_repository)

        # ── 1. GitHub Actions CI ──────────────────────────────────────────────
        _emit_event(db, version, DeploymentEventType.WORKFLOW_STARTED, EventSource.GITHUB)

        run_id = req.github_workflow_run_id
        if not run_id:
            _emit_event(db, version, DeploymentEventType.IMAGE_BUILD_FAILED, EventSource.GITHUB,
                        message="Não foi possível obter o run_id do workflow — verifica o GITHUB_TOKEN.")
            _fail_request(db, req, "github_workflow_run_id não resolvido", version=version)
            return

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
                        if req.deployment_type == DeploymentType.ROLLBACK:
                            # A ROLLBACK reusa a imagem do target — o run do GitHub Actions
                            # não fez build nenhum novo (o workflow salta build/push quando
                            # action=rollback), e o seu head_sha é sempre o HEAD atual do
                            # branch no momento do dispatch, não o commit do target. Usar
                            # esse head_sha aqui gravaria a versão errada: pareceria que o
                            # rollback "voltou" ao commit atual, quando na prática reverteu
                            # a imagem para o target.
                            target = db.get(DeploymentVersion, req.rollback_target_version_id)
                            version.image_tag = target.image_tag
                            version.source_commit_sha = target.source_commit_sha
                        else:
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
                                    message=f"Workflow run {run_id} terminou com: {run['conclusion']}")
                        _fail_request(db, req, f"GitHub Actions falhou: {run['conclusion']}", version=version)
                        return
            except Exception as e:
                _emit_event(db, version, DeploymentEventType.IMAGE_BUILD_FAILED, EventSource.GITHUB, message=str(e))
                _fail_request(db, req, str(e), version=version)
                return
        else:
            _timeout(db, req, version=version)
            return

        if cluster_ctx is None:
            _emit_event(db, version, DeploymentEventType.GITOPS_UPDATED, EventSource.GITHUB,
                        message="Cluster não configurado — pipeline termina após CI.")
            req.status = RequestStatus.SUCCESS
            req.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        try:
            eks_info = get_cluster_token(
                iam_role_arn=cluster_ctx.iam_role_arn,
                external_id=cluster_ctx.external_id,
                cluster_arn=cluster_ctx.cluster_arn,
            )
        except Exception as e:
            _emit_event(db, version, DeploymentEventType.SYNC_FAILED, EventSource.KUBERNETES,
                        message=f"Erro ao obter token do cluster: {e}")
            _fail_request(db, req, f"Falha de autenticação no cluster: {e}", version=version)
            return

        # ── 2. ArgoCD sync (opcional) ─────────────────────────────────────────
        # O nome da Application no ArgoCD é definido pelo Terraform de cada projeto e não
        # segue nenhuma convenção fixa — por isso é configurável por Environment. Confirmado
        # contra a instância real de ArgoCD: uma Application sincroniza todo o caminho
        # apps/demo-app/{env}, partilhada por todas as Applications desse Environment.
        argocd_app_name = env.argocd_application_name or f"demo-app-{env.name.lower()}"
        argocd_namespace = cluster_ctx.argocd_namespace
        sync_phase_seen: set[str] = set()
        argocd_misses = 0
        argocd_available = True

        while time.monotonic() < deadline and argocd_available:
            time.sleep(_POLL_INTERVAL)
            try:
                argocd_app = get_argocd_application(eks_info, argocd_app_name, argocd_namespace)
                argocd_misses = 0
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
                                message=f"ArgoCD sync: {phase}")
                    _fail_request(db, req, f"ArgoCD sync falhou: {phase}", version=version)
                    return

            except KubernetesNotFoundError:
                # Nome/namespace errados não se resolvem sozinhos com mais tentativas —
                # desiste já, em vez de gastar _ARGOCD_MAX_MISSES tentativas inúteis.
                argocd_available = False
                _emit_event(db, version, DeploymentEventType.GITOPS_UPDATED, EventSource.KUBERNETES,
                            message=f"ArgoCD Application '{argocd_app_name}' não encontrada no namespace "
                                    f"'{argocd_namespace}' — a observar K8s directamente.")

            except Exception:
                argocd_misses += 1
                if argocd_misses >= _ARGOCD_MAX_MISSES:
                    # Ligação/autenticação ao ArgoCD indisponível — continua para K8s directamente
                    argocd_available = False
                    _emit_event(db, version, DeploymentEventType.GITOPS_UPDATED, EventSource.KUBERNETES,
                                message="ArgoCD não detectado — a observar K8s directamente.")

        if argocd_available and time.monotonic() >= deadline:
            _timeout(db, req, version=version)
            return

        # ── 3. K8s Deployment rollout ─────────────────────────────────────────
        namespace = env.namespace or env.name.lower()
        deployment_name = app_env.deployment_name
        rollout_started = False
        rollout_done = False
        k8s_misses = 0

        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                dep = list_deployment(eks_info, namespace, deployment_name)
                k8s_misses = 0
                for c in dep.status.conditions or []:
                    if c.type == "Progressing":
                        if not rollout_started and c.reason == "ReplicaSetUpdated":
                            rollout_started = True
                            _emit_event(db, version, DeploymentEventType.ROLLOUT_STARTED, EventSource.KUBERNETES)
                        if not rollout_done and c.reason == "NewReplicaSetAvailable":
                            rollout_done = True
                            _emit_event(db, version, DeploymentEventType.ROLLOUT_COMPLETED, EventSource.KUBERNETES)
                            version.lifecycle_status = LifecycleStatus.HEALTHY
                            version.deployed_at = datetime.now(timezone.utc)
                            _supersede_previous_version(db, version, req.deployment_type)
                            db.commit()
                if rollout_done:
                    break
            except Exception as e:
                k8s_misses += 1
                if k8s_misses == 5:
                    _emit_event(db, version, DeploymentEventType.SYNC_FAILED, EventSource.KUBERNETES,
                                message=f"Erro ao observar Deployment/{deployment_name}: {e}")
        else:
            _timeout(db, req, version=version)
            return

        # ── 4. Pod readiness + erros de container ────────────────────────────
        known_pods: set[str] = set()
        ready_seen = False
        failed_pods: set[str] = set()

        while time.monotonic() < deadline:
            time.sleep(_POLL_INTERVAL)
            try:
                pod_list = list_pods_in_namespace(eks_info, namespace)
                for pod in pod_list.items:
                    pod_name = pod.metadata.name
                    if not pod_name.startswith(f"{deployment_name}-"):
                        continue
                    if pod_name not in known_pods:
                        known_pods.add(pod_name)
                        _emit_event(db, version, DeploymentEventType.POD_CREATED, EventSource.KUBERNETES,
                                    message=pod_name)

                raw = http.get(
                    f"{eks_info.endpoint}/api/v1/namespaces/{namespace}/pods",
                    headers={"Authorization": f"Bearer {eks_info.bearer_token}", "x-k8s-aws-id": eks_info.name},
                    verify=eks_info.ca_file_path, timeout=10,
                ).json()

                for item in raw.get("items", []):
                    pod_name = item["metadata"]["name"]
                    if not pod_name.startswith(f"{deployment_name}-"):
                        continue

                    # Container waiting reasons — fatal errors
                    for cs in item.get("status", {}).get("containerStatuses", []):
                        waiting = (cs.get("state") or {}).get("waiting") or {}
                        reason = waiting.get("reason", "")
                        if reason in _FATAL_POD_REASONS and pod_name not in failed_pods:
                            failed_pods.add(pod_name)
                            msg = waiting.get("message") or reason
                            _emit_event(db, version, DeploymentEventType.CRASH_LOOP_BACKOFF, EventSource.KUBERNETES,
                                        message=f"{pod_name}: {msg}")
                            _fail_request(db, req, f"{reason} em {pod_name}: {msg}", version=version, post_rollout=True)
                            return

                    # Readiness
                    for cond in item.get("status", {}).get("conditions", []):
                        if cond.get("type") == "Ready":
                            if cond.get("status") == "True" and not ready_seen:
                                ready_seen = True
                                _emit_event(db, version, DeploymentEventType.READINESS_PASSED, EventSource.KUBERNETES,
                                            message=pod_name)
                            elif cond.get("status") == "False" and ready_seen:
                                _emit_event(db, version, DeploymentEventType.READINESS_FAILED, EventSource.KUBERNETES,
                                            message=f"{pod_name}: {cond.get('message', '')}")
                                _fail_request(db, req, f"Pod {pod_name} perdeu readiness", version=version, post_rollout=True)
                                return

                if ready_seen:
                    break
            except Exception as e:
                _emit_event(db, version, DeploymentEventType.READINESS_FAILED, EventSource.KUBERNETES,
                            message=f"Erro ao observar pods: {e}")
        else:
            _timeout(db, req, version=version, post_rollout=True)
            return

        # ── SUCCESS ───────────────────────────────────────────────────────────
        req.status = RequestStatus.SUCCESS
        req.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        try:
            db.rollback()
            req = db.get(DeploymentRequest, deployment_request_id)
            if req and req.status == RequestStatus.RUNNING:
                v = db.query(DeploymentVersion).filter(
                    DeploymentVersion.deployment_request_id == deployment_request_id
                ).first()
                _fail_request(db, req, f"Erro inesperado no observer: {e}", version=v)
        except Exception:
            pass
    finally:
        db.close()


_NON_TERMINAL_STATUSES = (LifecycleStatus.DEPLOYING, LifecycleStatus.HEALTHY, LifecycleStatus.DEGRADED)


def _supersede_previous_version(db, new_version: DeploymentVersion, deployment_type: DeploymentType) -> None:
    """
    Chamada quando o rollout da nova versão está confirmado como completo. A versão
    não-terminal mais recente da mesma application_environment é:
    - marcada RolledBack, se este deploy for um ROLLBACK (independente do estado em que
      estava — RolledBack é um registo factual do que aconteceu, não um juízo de qualidade);
    - marcada Superseded, SÓ SE estava Healthy no momento da substituição — Superseded
      significa "foi boa, entretanto foi ultrapassada", nunca "estava avariada e foi
      ultrapassada". Se estava Degraded (ou outro estado não-Healthy), mantém esse estado —
      é histórico real que não deve ser apagado, e não deve voltar a ser oferecida como alvo
      de rollback mais tarde.
    """
    previous = (
        db.query(DeploymentVersion)
        .filter(
            DeploymentVersion.application_environment_id == new_version.application_environment_id,
            DeploymentVersion.id != new_version.id,
            DeploymentVersion.lifecycle_status.in_(_NON_TERMINAL_STATUSES),
        )
        .order_by(DeploymentVersion.created_at.desc())
        .first()
    )
    if previous is None:
        return
    if deployment_type == DeploymentType.ROLLBACK:
        previous.lifecycle_status = LifecycleStatus.ROLLED_BACK
    elif previous.lifecycle_status == LifecycleStatus.HEALTHY:
        previous.lifecycle_status = LifecycleStatus.SUPERSEDED
    # else: estava Degraded (ou outro não-Healthy) — não mexer, fica como está.


def compute_lifecycle_status(events: list[DeploymentEvent]) -> LifecycleStatus:
    """
    Pure function: derive Deploying/Healthy/Degraded from a version's ordered events.
    Failed/RolledBack/Superseded are written by other triggers, never by this function.
    """
    types_seen = {e.event_type for e in events}
    if DeploymentEventType.CRASH_LOOP_BACKOFF in types_seen or DeploymentEventType.READINESS_FAILED in types_seen:
        return LifecycleStatus.DEGRADED
    if DeploymentEventType.ROLLOUT_COMPLETED in types_seen:
        return LifecycleStatus.HEALTHY
    return LifecycleStatus.DEPLOYING


def _fail_request(db, req: DeploymentRequest, reason: str, version: DeploymentVersion | None = None,
                   post_rollout: bool = False) -> None:
    """
    post_rollout=True means the K8s rollout already completed (phase 3 done) — the request
    itself stays SUCCESS and only the version's health degrades. Otherwise (phases 1-3) the
    request is FAILED and the version is terminal Failed.
    """
    if post_rollout:
        if req.status == RequestStatus.RUNNING:
            req.status = RequestStatus.SUCCESS
            req.completed_at = datetime.now(timezone.utc)
        if version is not None:
            version.lifecycle_status = LifecycleStatus.DEGRADED
        db.commit()
        return
    req.status = RequestStatus.FAILED
    req.failure_reason = reason
    req.completed_at = datetime.now(timezone.utc)
    if version is not None:
        version.lifecycle_status = LifecycleStatus.FAILED
    db.commit()


def _timeout(db, req: DeploymentRequest, version: DeploymentVersion | None = None, post_rollout: bool = False) -> None:
    _fail_request(db, req, "Timeout: pipeline did not reach a terminal state within 15 minutes",
                  version=version, post_rollout=post_rollout)
