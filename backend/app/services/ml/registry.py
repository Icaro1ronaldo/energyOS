from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ...models.ml_model_registry import MlModelRegistry
from ...core.database import SyncSessionLocal


def get_active_model_key(
    domain: str, bidding_zone: str, production_type: str | None = None
) -> str | None:
    """Return the S3 key of the current active model, or None if not trained yet."""
    with SyncSessionLocal() as db:
        row = (
            db.query(MlModelRegistry)
            .filter(
                MlModelRegistry.domain == domain,
                MlModelRegistry.bidding_zone == bidding_zone,
                MlModelRegistry.production_type == production_type,
                MlModelRegistry.is_active == True,
            )
            .order_by(MlModelRegistry.trained_at.desc())
            .first()
        )
        return row.s3_key if row else None


def register_model(
    db: Session,
    domain: str,
    bidding_zone: str,
    s3_key: str,
    production_type: str | None = None,
) -> None:
    """Deactivate the previous model and register the new one as active."""
    db.query(MlModelRegistry).filter(
        MlModelRegistry.domain == domain,
        MlModelRegistry.bidding_zone == bidding_zone,
        MlModelRegistry.production_type == production_type,
        MlModelRegistry.is_active == True,
    ).update({"is_active": False})

    db.add(
        MlModelRegistry(
            domain=domain,
            bidding_zone=bidding_zone,
            production_type=production_type,
            s3_key=s3_key,
            trained_at=datetime.now(timezone.utc),
            is_active=True,
        )
    )
    db.commit()
