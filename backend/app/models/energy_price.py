from sqlalchemy import Column, String, Numeric, Boolean, Index, DateTime
from .base import Base


class EnergyPrice(Base):
    __tablename__ = "energy_prices"

    timestamp = Column(DateTime(timezone=True), nullable=False, primary_key=True)
    bidding_zone = Column(String(20), nullable=False, primary_key=True)
    is_forecast = Column(Boolean, nullable=False, primary_key=True, default=False)
    price_eur_mwh = Column(Numeric(10, 4))

    __table_args__ = (
        Index("ix_energy_prices_zone_ts", "bidding_zone", "timestamp"),
    )
