from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal


class ProductionPoint(BaseModel):
    timestamp: datetime
    bidding_zone: str
    production_type: str
    value_mw: Decimal | None
    is_forecast: bool

    model_config = {"from_attributes": True}


class ProductionResponse(BaseModel):
    zone: str
    production_type: str
    actuals: list[ProductionPoint]
    forecasts: list[ProductionPoint]
