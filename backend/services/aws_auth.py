import logging
import boto3
import os

logger = logging.getLogger(__name__)


def assume_user_role(role_arn: str, external_id: str, region: str) -> boto3.Session:
    """Raises RuntimeError with a generic message on any failure (bad role/external-id,
    missing AWS credentials/profile on this server, network issues, ...). The real
    exception is logged server-side only — it can contain internal deployment details
    (e.g. a missing local AWS config profile) that mean nothing to the end user."""
    try:
        session = boto3.Session(profile_name=os.environ.get("DEVSHIP_AWS_PROFILE", "default"))
        sts_client = session.client("sts")

        response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="SessionValidDevShip",
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
