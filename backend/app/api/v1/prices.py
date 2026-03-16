from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_async_db
from ...models.energy_price import EnergyPrice
from ...models.energy_load import EnergyLoad
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

    # Anchor timestamp = load last-actual for this zone.
    # The ML worker anchors both hindcast and forward forecast at this date,
    # so we split price forecast rows at the same boundary.
    anchor_result = await db.execute(
        select(func.max(EnergyLoad.timestamp)).where(
            EnergyLoad.bidding_zone == zone,
            ~EnergyLoad.is_forecast,
        )
    )
    anchor_ts = anchor_result.scalar()

    # All price forecast rows (bounded set: ~7d hindcast + 48h forward ≈ 864 rows)
    all_fc_result = await db.execute(
        select(EnergyPrice)
        .where(
            EnergyPrice.bidding_zone == zone,
            EnergyPrice.is_forecast,
        )
        .order_by(EnergyPrice.timestamp)
    )
    all_fc = all_fc_result.scalars().all()

    if anchor_ts is None:
        hindcasts_rows = all_fc
        forecasts_rows: list = []
    else:
        hindcasts_rows = [r for r in all_fc if r.timestamp <= anchor_ts]
        forecasts_rows = [r for r in all_fc if r.timestamp > anchor_ts]

    return PriceResponse(
        zone=zone,
        actuals=[PricePoint.model_validate(r) for r in actuals_result.scalars().all()],
        hindcasts=[PricePoint.model_validate(r) for r in hindcasts_rows],
        forecasts=[PricePoint.model_validate(r) for r in forecasts_rows],
    )
