import logging
import re
import boto3
import os

logger = logging.getLogger(__name__)

_ROLE_SESSION_NAME = "SessionValidDevShip"
_ROLE_ARN_RE = re.compile(r"^arn:aws:iam::(\d+):role/(.+)$")


def compute_rbac_subject(iam_role_arn: str) -> str | None:
    """The subject a ClusterRoleBinding must use for this role, once the EKS Access Entry
    authenticates the assumed session — not the IAM Role ARN itself. Must match the fixed
    RoleSessionName used in assume_user_role() below, or any binding built from this never
    matches (RBAC doesn't validate the subject at creation, only at request time — always
    a silent failure until then). Returns None if iam_role_arn isn't in the expected format."""
    m = _ROLE_ARN_RE.match(iam_role_arn)
    if not m:
        return None
    account_id, role_name = m.groups()
    return f"arn:aws:sts::{account_id}:assumed-role/{role_name}/{_ROLE_SESSION_NAME}"


def assume_user_role(role_arn: str, external_id: str, region: str) -> boto3.Session:
    """Raises RuntimeError with a generic message on any failure (bad role/external-id,
    missing AWS credentials/profile on this server, network issues, ...). The real
    exception is logged server-side only — it can contain internal deployment details
    (e.g. a missing local AWS config profile) that mean nothing to the end user."""
    try:
        # ponytail: profile only set locally in dev; in prod the instance role is picked
        # up automatically via IMDS when DEVSHIP_AWS_PROFILE is unset
        profile_name = os.environ.get("DEVSHIP_AWS_PROFILE")
        session = boto3.Session(profile_name=profile_name) if profile_name else boto3.Session()
        sts_client = session.client("sts")

        response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=_ROLE_SESSION_NAME,
            ExternalId=external_id,
        )

        credentials = response["Credentials"]

        return boto3.Session(
            aws_access_key_id=credentials["AccessKeyId"],
            aws_secret_access_key=credentials["SecretAccessKey"],
            aws_session_token=credentials["SessionToken"],
            region_name=region,
        )

    except Exception:
        logger.exception("assume_user_role failed (role_arn=%s, region=%s)", role_arn, region)
        raise RuntimeError("Não foi possível autenticar com o cluster.")
