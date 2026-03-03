from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.database import get_async_db
from ...models.energy_price import EnergyPrice
from ...schemas.price import PricePoint, PriceResponse

router = APIRouter()


@router.get("/{zone}", response_model=PriceResponse)
async def get_prices(
    zone: str,
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    if end is None:
        end = datetime.now(timezone.utc)
    if start is None:
        start = end - timedelta(days=7)

    result = await db.execute(
        select(EnergyPrice)
        .where(
            EnergyPrice.bidding_zone == zone,
            EnergyPrice.timestamp >= start,
            EnergyPrice.timestamp <= end,
        )
        .order_by(EnergyPrice.timestamp)
    )
    rows = result.scalars().all()

    return PriceResponse(
        zone=zone,
        actuals=[PricePoint.model_validate(r) for r in rows if not r.is_forecast],
        forecasts=[PricePoint.model_validate(r) for r in rows if r.is_forecast],
    )
