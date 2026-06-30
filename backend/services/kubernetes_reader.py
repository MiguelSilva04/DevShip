import requests

from backend.services.eks_discovery import EKSClusterInfo


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
        pod = type("Pod", (), {
            "metadata": type("Metadata", (), {
                "name": item["metadata"]["name"],
                "namespace": item["metadata"].get("namespace", "default"),
            })(),
            "status": type("Status", (), {
                "phase": item.get("status", {}).get("phase", "Unknown"),
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


def get_argocd_application(cluster: EKSClusterInfo, app_name: str):
    return _list_items(cluster, f"/apis/argoproj.io/v1alpha1/namespaces/argocd/applications/{app_name}", parse_argocd_application)
