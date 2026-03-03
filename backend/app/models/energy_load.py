from sqlalchemy import Column, String, Numeric, Boolean, Index, DateTime
from .base import Base


class EnergyLoad(Base):
    __tablename__ = "energy_loads"

    timestamp = Column(DateTime(timezone=True), nullable=False, primary_key=True)
    bidding_zone = Column(String(20), nullable=False, primary_key=True)
    is_forecast = Column(Boolean, nullable=False, primary_key=True, default=False)
    load_mw = Column(Numeric(12, 2))

    __table_args__ = (
        Index("ix_energy_loads_zone_ts", "bidding_zone", "timestamp"),
    )
