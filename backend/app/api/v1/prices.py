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

    # Actuals: filter by the requested window
    actuals_result = await db.execute(
        select(EnergyPrice)
        .where(
            EnergyPrice.bidding_zone == zone,
            ~EnergyPrice.is_forecast,
            EnergyPrice.timestamp >= start,
            EnergyPrice.timestamp <= end,
        )
        .order_by(EnergyPrice.timestamp)
    )

    # Forecasts: return ALL rows — the ML writer deletes and rewrites them
    # every run, so the set is bounded (~7*24 hindcast + 48h forward ≈ 216 rows).
    # NOT filtering by date range here because the forecast window is anchored
    # at the last actual data point, which may be older than the user's view.
    forecasts_result = await db.execute(
        select(EnergyPrice)
        .where(
            EnergyPrice.bidding_zone == zone,
            EnergyPrice.is_forecast,
        )
        .order_by(EnergyPrice.timestamp)
    )

    return PriceResponse(
        zone=zone,
        actuals=[PricePoint.model_validate(r) for r in actuals_result.scalars().all()],
        forecasts=[PricePoint.model_validate(r) for r in forecasts_result.scalars().all()],
    )
