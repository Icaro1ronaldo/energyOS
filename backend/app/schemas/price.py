from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal


class PricePoint(BaseModel):
    timestamp: datetime
    bidding_zone: str
    price_eur_mwh: Decimal | None
    is_forecast: bool

    model_config = {"from_attributes": True}


class PriceResponse(BaseModel):
    zone: str
    actuals: list[PricePoint]
    forecasts: list[PricePoint]
