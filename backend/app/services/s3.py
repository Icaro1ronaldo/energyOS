import io
import pickle
import boto3
from ..core.config import settings


def _client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def upload_model(model, s3_key: str) -> None:
    buf = io.BytesIO()
    pickle.dump(model, buf)
    buf.seek(0)
    _client().upload_fileobj(buf, settings.s3_bucket, s3_key)


def download_model(s3_key: str):
    buf = io.BytesIO()
    _client().download_fileobj(settings.s3_bucket, s3_key, buf)
    buf.seek(0)
    return pickle.load(buf)
