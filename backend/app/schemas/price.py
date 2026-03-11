from pydantic import BaseModel
from datetime import datetime


class PricePoint(BaseModel):
    timestamp: datetime
    bidding_zone: str
    price_eur_mwh: float | None
    price_lower_eur_mwh: float | None = None
    price_upper_eur_mwh: float | None = None
    is_forecast: bool

    model_config = {"from_attributes": True}


class PriceResponse(BaseModel):
    zone: str
    actuals: list[PricePoint]
    forecasts: list[PricePoint]
