from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal


class LoadPoint(BaseModel):
    timestamp: datetime
    bidding_zone: str
    load_mw: Decimal | None
    is_forecast: bool

    model_config = {"from_attributes": True}


class LoadResponse(BaseModel):
    zone: str
    actuals: list[LoadPoint]
    forecasts: list[LoadPoint]
