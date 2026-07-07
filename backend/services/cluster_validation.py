"""
Orchestrates STS AssumeRole → EKS DescribeCluster → K8s list_namespaces.
Raises ValueError with a generic, user-safe message on any failure — the real
exception (which can contain internal AWS/deployment details meaningless to an
end user) is logged server-side only, never put in the message shown to the user.
Callers must NOT persist anything until this returns successfully.
"""

import logging

from backend.services.aws_auth import assume_user_role
from backend.services.eks_discovery import describe_eks_cluster, EKSClusterInfo
from backend.services.kubernetes_reader import list_namespaces

logger = logging.getLogger(__name__)

_CONNECTION_FAILED_MESSAGE = (
    "Não foi possível ligar ao cluster. Verifica se o cluster ainda existe e se as "
    "credenciais (Cluster ARN / IAM Role ARN) continuam válidas."
)


def validate_cluster(cluster_arn: str, iam_role_arn: str, external_id: str) -> EKSClusterInfo:
    """
    Returns EKSClusterInfo on success. Raises ValueError on any validation failure.
    Order: STS AssumeRole → EKS DescribeCluster → K8s list_namespaces.
    Nothing is persisted here.
    """
    from backend.services.eks_discovery import extract_region_from_eks_arn
    region = extract_region_from_eks_arn(cluster_arn)

    # 1. STS AssumeRole
    try:
        session = assume_user_role(role_arn=iam_role_arn, external_id=external_id, region=region)
    except Exception as e:
        logger.exception("validate_cluster: STS AssumeRole phase failed")
        raise ValueError(_CONNECTION_FAILED_MESSAGE) from e

    # 2. EKS DescribeCluster + generate bearer token
    try:
        cluster_info = describe_eks_cluster(session=session, cluster_arn=cluster_arn)
    except Exception as e:
        logger.exception("validate_cluster: EKS DescribeCluster phase failed")
        raise ValueError(_CONNECTION_FAILED_MESSAGE) from e

    # 3. K8s connectivity check via list_namespaces
    try:
        list_namespaces(cluster_info)
    except Exception as e:
        logger.exception("validate_cluster: Kubernetes connectivity phase failed")
        raise ValueError(_CONNECTION_FAILED_MESSAGE) from e

    return cluster_info


def get_cluster_token(iam_role_arn: str, external_id: str, cluster_arn: str) -> EKSClusterInfo:
    """Re-authenticate and return a fresh EKSClusterInfo (with new bearer_token) for an already-configured cluster."""
    from backend.services.eks_discovery import extract_region_from_eks_arn
    region = extract_region_from_eks_arn(cluster_arn)
    try:
        session = assume_user_role(role_arn=iam_role_arn, external_id=external_id, region=region)
        return describe_eks_cluster(session=session, cluster_arn=cluster_arn)
    except Exception as e:
        logger.exception("get_cluster_token failed")
        raise ValueError(_CONNECTION_FAILED_MESSAGE) from e
