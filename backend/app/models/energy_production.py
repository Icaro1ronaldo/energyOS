from sqlalchemy import Column, String, Numeric, Boolean, Index, DateTime
from .base import Base

PRODUCTION_TYPES = [
    "solar",
    "wind_onshore",
    "wind_offshore",
    "nuclear",
    "hydro_run_of_river",
    "hydro_reservoir",
    "hydro_pumped_storage",
    "fossil_gas",
    "fossil_coal",
    "fossil_oil",
    "biomass",
    "geothermal",
    "other_renewable",
    "other",
]


class EnergyProduction(Base):
    __tablename__ = "energy_productions"

    timestamp = Column(DateTime(timezone=True), nullable=False, primary_key=True)
    bidding_zone = Column(String(20), nullable=False, primary_key=True)
    production_type = Column(String(50), nullable=False, primary_key=True)
    is_forecast = Column(Boolean, nullable=False, primary_key=True, default=False)
    value_mw = Column(Numeric(12, 2))

    __table_args__ = (
        Index("ix_energy_productions_zone_type_ts", "bidding_zone", "production_type", "timestamp"),
    )
