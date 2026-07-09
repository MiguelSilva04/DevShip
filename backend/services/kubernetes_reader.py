import time

import requests

from backend.services.eks_discovery import EKSClusterInfo


class KubernetesNotFoundError(Exception):
    """404 from the K8s API — the resource genuinely doesn't exist at this path,
    as opposed to an auth/connectivity failure. Callers that need to tell
    "wrong name/namespace" apart from "cluster unreachable" catch this specifically."""


def api_request(endpoint: str, path: str, token: str, cluster_name: str, ca_file: str, method: str = "GET"):
    headers = {
        "Authorization": f"Bearer {token}",
        "x-k8s-aws-id": cluster_name,
        "Content-Type": "application/json",
    }
    url = f"{endpoint}{path}"
    response = requests.request(method, url, headers=headers, verify=ca_file)

    if response.status_code == 401:
        raise Exception(f"Unauthorized (401): {response.text}")
    elif response.status_code == 403:
        raise Exception(f"Authenticated but without access entries permissions: {response.text}")
    elif response.status_code == 404:
        raise KubernetesNotFoundError(f"Not found (404): {path}")
    elif response.status_code >= 400:
        raise Exception(f"HTTP {response.status_code}: {response.text}")

    return response.json()


def parse_namespaces(data: dict):
    namespaces = []
    for item in data.get("items", []):
        namespace = type("Namespace", (), {
            "metadata": type("Metadata", (), {"name": item["metadata"]["name"]})(),
        })()
        namespaces.append(namespace)
    return type("NamespaceList", (), {"items": namespaces})()


def parse_nodes(data: dict):
    nodes = []
    for item in data.get("items", []):
        node = type("Node", (), {
            "metadata": type("Metadata", (), {"name": item["metadata"]["name"]})(),
            "status": type("Status", (), {
                "conditions": [
                    type("Condition", (), {"type": c["type"], "status": c["status"]})()
                    for c in item.get("status", {}).get("conditions", [])
                ]
            })(),
        })()
        nodes.append(node)
    return type("NodeList", (), {"items": nodes})()


def parse_deployments(data: dict):
    deployments = []
    for item in data.get("items", []):
        deployment = type("Deployment", (), {
            "metadata": type("Metadata", (), {
                "name": item["metadata"]["name"],
                "namespace": item["metadata"].get("namespace", "default"),
            })(),
            "status": type("Status", (), {
                "conditions": [
                    type("Condition", (), {"type": c["type"], "status": c["status"], "reason": c.get("reason", "")})()
                    for c in item.get("status", {}).get("conditions", [])
                ]
            })(),
        })()
        deployments.append(deployment)
    return type("DeploymentList", (), {"items": deployments})()


def parse_deployment(deployment):
    return type("Deployment", (), {
        "metadata": type("Metadata", (), {
            "name": deployment["metadata"]["name"],
            "namespace": deployment["metadata"].get("namespace", "default"),
        })(),
        "status": type("Status", (), {
            "conditions": [
                type("Condition", (), {"type": c["type"], "status": c["status"], "reason": c.get("reason", "")})()
                for c in deployment.get("status", {}).get("conditions", [])
            ]
        })(),
    })()


def parse_pods(data: dict):
    pods = []
    for item in data.get("items", []):
        container_statuses = item.get("status", {}).get("containerStatuses", [])
        restart_count = sum(cs.get("restartCount", 0) for cs in container_statuses)
        ready_count = sum(1 for cs in container_statuses if cs.get("ready"))
        pod = type("Pod", (), {
            "metadata": type("Metadata", (), {
                "name": item["metadata"]["name"],
                "namespace": item["metadata"].get("namespace", "default"),
                "creation_timestamp": item["metadata"].get("creationTimestamp"),
            })(),
            "spec": type("Spec", (), {
                "node_name": item.get("spec", {}).get("nodeName"),
            })(),
            "status": type("Status", (), {
                "phase": item.get("status", {}).get("phase", "Unknown"),
                "restart_count": restart_count,
                "ready_count": ready_count,
                "container_count": len(container_statuses),
            })(),
        })()
        pods.append(pod)
    return type("PodList", (), {"items": pods})()


def parse_argocd_application(data: dict):
    operation_state = data.get("status", {}).get("operationState", {}) or {}
    health = data.get("status", {}).get("health", {}) or {}
    sync = data.get("status", {}).get("sync", {}) or {}
    return type("ArgoCDApplication", (), {
        "metadata": type("Metadata", (), {
            "name": data["metadata"]["name"],
            "namespace": data["metadata"].get("namespace", "argocd"),
        })(),
        "status": type("Status", (), {
            "sync_status": sync.get("status", "Unknown"),
            "sync_revision": sync.get("revision"),
            "health_status": health.get("status", "Unknown"),
            "operation_phase": operation_state.get("phase", ""),
        })(),
    })()


def _list_items(cluster: EKSClusterInfo, path: str, parser):
    data = api_request(
        endpoint=cluster.endpoint,
        path=path,
        token=cluster.bearer_token,
        cluster_name=cluster.name,
        ca_file=cluster.ca_file_path,
    )
    return parser(data)


def list_namespaces(cluster: EKSClusterInfo):
    return _list_items(cluster, "/api/v1/namespaces", parse_namespaces)


def check_argocd_access(cluster: EKSClusterInfo, namespace: str) -> None:
    """Raises on any failure (typically 403 — missing RBAC). Success means the binding for
    applications.argoproj.io is mounted, regardless of whether any Application already
    exists in that namespace — this is a LIST, not a GET on a specific Application, so it
    works even before Environments exist."""
    api_request(
        endpoint=cluster.endpoint,
        path=f"/apis/argoproj.io/v1alpha1/namespaces/{namespace}/applications",
        token=cluster.bearer_token,
        cluster_name=cluster.name,
        ca_file=cluster.ca_file_path,
    )


def check_metrics_access(cluster: EKSClusterInfo) -> None:
    """Raises on any failure — 403 means missing RBAC, other errors may mean metrics-server
    isn't installed at all (the aggregated API isn't registered). Cluster-wide LIST, no
    namespace — doesn't depend on any pods existing yet."""
    api_request(
        endpoint=cluster.endpoint,
        path="/apis/metrics.k8s.io/v1beta1/pods",
        token=cluster.bearer_token,
        cluster_name=cluster.name,
        ca_file=cluster.ca_file_path,
    )


def list_nodes(cluster: EKSClusterInfo):
    return _list_items(cluster, "/api/v1/nodes", parse_nodes)


def list_pods_all_namespaces(cluster: EKSClusterInfo):
    return _list_items(cluster, "/api/v1/pods", parse_pods)


def list_pods_in_namespace(cluster: EKSClusterInfo, namespace: str):
    return _list_items(cluster, f"/api/v1/namespaces/{namespace}/pods", parse_pods)


def list_deployment(cluster: EKSClusterInfo, namespace: str, deployment: str):
    return _list_items(cluster, f"/apis/apps/v1/namespaces/{namespace}/deployments/{deployment}", parse_deployment)


def list_deployments(cluster: EKSClusterInfo, namespace: str):
    return _list_items(cluster, f"/apis/apps/v1/namespaces/{namespace}/deployments", parse_deployments)


def get_argocd_application(cluster: EKSClusterInfo, app_name: str, namespace: str = "argocd"):
    return _list_items(cluster, f"/apis/argoproj.io/v1alpha1/namespaces/{namespace}/applications/{app_name}", parse_argocd_application)


def pod_metrics(cluster: EKSClusterInfo, namespace: str) -> dict[str, dict[str, str]]:
    """
    CPU/mem per pod from the Metrics API (requires metrics-server in-cluster).
    Raises on failure — callers show "—" rather than swallow the error here.
    Values are returned as raw Kubernetes quantities (e.g. "42m", "128Mi").

    One retry after a short delay: right after metrics-server (re)starts, the API
    aggregation layer can 404/timeout for a few seconds before scraping catches up —
    without this, that moment falsely reads as "metrics unavailable" for every pod,
    including ones that are perfectly healthy.
    """
    try:
        data = api_request(
            endpoint=cluster.endpoint,
            path=f"/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods",
            token=cluster.bearer_token,
            cluster_name=cluster.name,
            ca_file=cluster.ca_file_path,
        )
    except Exception:
        time.sleep(1)
        data = api_request(
            endpoint=cluster.endpoint,
            path=f"/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods",
            token=cluster.bearer_token,
            cluster_name=cluster.name,
            ca_file=cluster.ca_file_path,
        )
    result = {}
    for item in data.get("items", []):
        pod_name = item["metadata"]["name"]
        containers = item.get("containers", [])
        cpu = containers[0]["usage"]["cpu"] if containers else None
        mem = containers[0]["usage"]["memory"] if containers else None
        result[pod_name] = {"cpu": cpu, "memory": mem}
    return result


def parse_events(data: dict):
    events = []
    for item in data.get("items", []):
        involved = item.get("involvedObject", {}) or {}
        event = type("Event", (), {
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "message": item.get("message", ""),
            "object_ref": f"{involved.get('kind', '')}/{involved.get('name', '')}",
            "last_timestamp": item.get("lastTimestamp") or item.get("eventTime"),
        })()
        events.append(event)
    return type("EventList", (), {"items": events})()


def list_events_in_namespace(cluster: EKSClusterInfo, namespace: str):
    return _list_items(cluster, f"/api/v1/namespaces/{namespace}/events", parse_events)


def get_pod_logs(cluster: EKSClusterInfo, namespace: str, pod_name: str, tail_lines: int = 500) -> str:
    """Plain-text pod log read — /log does not return JSON, so it bypasses api_request()."""
    url = f"{cluster.endpoint}/api/v1/namespaces/{namespace}/pods/{pod_name}/log?tailLines={tail_lines}"
    headers = {
        "Authorization": f"Bearer {cluster.bearer_token}",
        "x-k8s-aws-id": cluster.name,
    }
    response = requests.get(url, headers=headers, verify=cluster.ca_file_path)
    if response.status_code >= 400:
        raise Exception(f"HTTP {response.status_code}: {response.text}")
    return response.text


_FATAL_POD_REASONS = {"CrashLoopBackOff", "ErrImagePull", "ImagePullBackOff", "OOMKilled", "Error"}


def pod_health_snapshot(cluster: EKSClusterInfo, namespace: str, deployment_name: str) -> tuple[bool, list[str]]:
    """
    Raw pod read (containerStatuses/conditions aren't in parse_pods). Returns
    (any_ready, fatal_pod_messages) for this deployment's pods in the namespace —
    filtered by the "{deployment_name}-" pod name prefix so one app's crashing pod
    doesn't drag down every other app sharing the same namespace.
    """
    raw = api_request(
        endpoint=cluster.endpoint,
        path=f"/api/v1/namespaces/{namespace}/pods",
        token=cluster.bearer_token,
        cluster_name=cluster.name,
        ca_file=cluster.ca_file_path,
    )
    any_ready = False
    fatal: list[str] = []
    for item in raw.get("items", []):
        pod_name = item["metadata"]["name"]
        if not pod_name.startswith(f"{deployment_name}-"):
            continue
        for cs in item.get("status", {}).get("containerStatuses", []):
            waiting = (cs.get("state") or {}).get("waiting") or {}
            reason = waiting.get("reason", "")
            if reason in _FATAL_POD_REASONS:
                fatal.append(f"{pod_name}: {waiting.get('message') or reason}")
        for cond in item.get("status", {}).get("conditions", []):
            if cond.get("type") == "Ready" and cond.get("status") == "True":
                any_ready = True
    return any_ready, fatal


def _probe_spec(container: dict, probe_key: str) -> dict | None:
    """Extract a probe's config (path/port/delay/period/timeout/thresholds) from a
    container spec. Returns None if the container doesn't define that probe type."""
    probe = container.get(probe_key)
    if probe is None:
        return None
    http_get = probe.get("httpGet") or {}
    return {
        "path": http_get.get("path"),
        "port": http_get.get("port"),
        "initial_delay_seconds": probe.get("initialDelaySeconds", 0),
        "period_seconds": probe.get("periodSeconds", 10),
        "timeout_seconds": probe.get("timeoutSeconds", 1),
        "success_threshold": probe.get("successThreshold", 1),
        "failure_threshold": probe.get("failureThreshold", 3),
    }


def container_probe_statuses(cluster: EKSClusterInfo, namespace: str, deployment_name: str) -> list[dict]:
    """
    Per-container probe config + current state for this deployment's pods. Probe pass/fail
    is inferred from real signals the Kubernetes API exposes (readiness condition, waiting/
    terminated reason, restart count) — the API does not report per-probe-type pass/fail
    history, so "Startup"/"Liveness" status is derived, not a literal K8s field.
    """
    raw = api_request(
        endpoint=cluster.endpoint,
        path=f"/api/v1/namespaces/{namespace}/pods",
        token=cluster.bearer_token,
        cluster_name=cluster.name,
        ca_file=cluster.ca_file_path,
    )
    results: list[dict] = []
    for item in raw.get("items", []):
        pod_name = item["metadata"]["name"]
        if not pod_name.startswith(f"{deployment_name}-"):
            continue

        containers_spec = {c["name"]: c for c in item.get("spec", {}).get("containers", [])}
        statuses_by_name = {cs.get("name", ""): cs for cs in item.get("status", {}).get("containerStatuses", [])}
        ready_condition = next(
            (c for c in item.get("status", {}).get("conditions", []) if c.get("type") == "Ready"),
            {},
        )

        for name, cs in statuses_by_name.items():
            container_spec = containers_spec.get(name, {})
            state = cs.get("state") or {}
            last_state = cs.get("lastState") or {}

            if "running" in state:
                state_name, reason, message, error_at = "Running", None, None, None
            elif "waiting" in state:
                state_name = "Waiting"
                reason = state["waiting"].get("reason")
                message = state["waiting"].get("message")
                error_at = last_state.get("terminated", {}).get("finishedAt")
            elif "terminated" in state:
                state_name = "Terminated"
                reason = state["terminated"].get("reason")
                message = state["terminated"].get("message")
                error_at = state["terminated"].get("finishedAt")
            else:
                state_name, reason, message, error_at = "Unknown", None, None, None

            results.append({
                "pod_name": pod_name,
                "container_name": name,
                "ready": bool(cs.get("ready")),
                "restart_count": cs.get("restartCount", 0),
                "state": state_name,
                "reason": reason,
                "message": message,
                "error_at": error_at,
                "ready_transition_at": ready_condition.get("lastTransitionTime"),
                "startup_probe": _probe_spec(container_spec, "startupProbe"),
                "readiness_probe": _probe_spec(container_spec, "readinessProbe"),
                "liveness_probe": _probe_spec(container_spec, "livenessProbe"),
            })
    return results
