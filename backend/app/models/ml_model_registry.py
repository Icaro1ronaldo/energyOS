import uuid
from sqlalchemy import Column, String, Boolean, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from .base import Base


class MlModelRegistry(Base):
    __tablename__ = "ml_model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain = Column(String(20), nullable=False)        # prices | load | production
    bidding_zone = Column(String(20), nullable=False)
    production_type = Column(String(50), nullable=True) # null for prices / load
    s3_key = Column(Text, nullable=False)
    trained_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
