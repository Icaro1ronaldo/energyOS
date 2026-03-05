from pydantic import BaseModel
from datetime import datetime


class LoadPoint(BaseModel):
    timestamp: datetime
    bidding_zone: str
    load_mw: float | None
    is_forecast: bool

    model_config = {"from_attributes": True}


class LoadResponse(BaseModel):
    zone: str
    actuals: list[LoadPoint]
    forecasts: list[LoadPoint]
