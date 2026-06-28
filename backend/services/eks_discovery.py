import base64
import tempfile
from dataclasses import dataclass

from backend.services.eks_token_generator import generate_eks_bearer_token


@dataclass
class EKSClusterInfo:
    name: str
    arn: str
    region: str
    version: str
    status: str
    endpoint: str
    ca_certificate: str
    bearer_token: str
    ca_file_path: str = ""


def create_ca_file(ca_certificate: str) -> str:
    ca_cert_bytes = base64.b64decode(ca_certificate)
    ca_file = tempfile.NamedTemporaryFile(delete=False, suffix=".crt")
    ca_file.write(ca_cert_bytes)
    ca_file.close()
    return ca_file.name


def extract_region_from_eks_arn(cluster_arn: str) -> str:
    parts = cluster_arn.split(":")
    if len(parts) < 6:
        raise ValueError(f"ARN inválido: {cluster_arn}")
    service = parts[2]
    region = parts[3]
    if service != "eks":
        raise ValueError(f"O ARN não pertence ao serviço EKS: {cluster_arn}")
    return region


def describe_eks_cluster(session, cluster_arn: str) -> EKSClusterInfo:
    """Describe a single EKS cluster by ARN and return its info + bearer token."""
    region = extract_region_from_eks_arn(cluster_arn)
    cluster_name = cluster_arn.split("/")[-1]

    eks_client = session.client("eks", region_name=region)
    cluster_data = eks_client.describe_cluster(name=cluster_name)["cluster"]

    bearer_token = generate_eks_bearer_token(
        session=session,
        cluster_name=cluster_data["name"],
        region=region,
    )

    info = EKSClusterInfo(
        name=cluster_data["name"],
        arn=cluster_data["arn"],
        region=region,
        version=cluster_data["version"],
        status=cluster_data["status"],
        endpoint=cluster_data["endpoint"],
        ca_certificate=cluster_data["certificateAuthority"]["data"],
        bearer_token=bearer_token,
    )
    info.ca_file_path = create_ca_file(info.ca_certificate)
    return info
