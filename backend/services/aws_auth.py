import boto3
from botocore.exceptions import ClientError


def assume_user_role(role_arn: str, external_id: str, region: str) -> boto3.Session:
    sts_client = boto3.client("sts")

    try:
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

    except ClientError as error:
        raise RuntimeError(f"Erro ao assumir IAM Role: {error}")
