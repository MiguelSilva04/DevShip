import base64
from botocore.signers import RequestSigner


def generate_eks_bearer_token(session, cluster_name: str, region: str) -> str:
    service_id = session.client("sts").meta.service_model.service_id

    signer = RequestSigner(
        service_id,
        region,
        "sts",
        "v4",
        session.get_credentials(),
        session.events,
    )

    params = {
        "method": "GET",
        "url": f"https://sts.{region}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
        "body": {},
        "headers": {
            "x-k8s-aws-id": cluster_name
        },
        "context": {},
    }

    signed_url = signer.generate_presigned_url(
        params,
        region_name=region,
        expires_in=60,
        operation_name=""
    )

    base64_url = base64.urlsafe_b64encode(
        signed_url.encode("utf-8")
    ).decode("utf-8")

    base64_url = base64_url.rstrip("=")

    return f"k8s-aws-v1.{base64_url}"
