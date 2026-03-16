from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_async_db
from ...models.energy_load import EnergyLoad
from ...schemas.load import LoadPoint, LoadResponse

router = APIRouter()


@router.get("/{zone}", response_model=LoadResponse)
async def get_load(
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
        select(EnergyLoad)
        .where(
            EnergyLoad.bidding_zone == zone,
            ~EnergyLoad.is_forecast,
            EnergyLoad.timestamp >= start,
            EnergyLoad.timestamp <= end,
        )
        .order_by(EnergyLoad.timestamp)
    )

    # Anchor timestamp = load last-actual for this zone (same as ML worker anchor)
    anchor_result = await db.execute(
        select(func.max(EnergyLoad.timestamp)).where(
            EnergyLoad.bidding_zone == zone,
            ~EnergyLoad.is_forecast,
        )
    )
    anchor_ts = anchor_result.scalar()

    # All load forecast rows (bounded set: ~7d hindcast + 48h forward ≈ 863 rows)
    all_fc_result = await db.execute(
        select(EnergyLoad)
        .where(
            EnergyLoad.bidding_zone == zone,
            EnergyLoad.is_forecast,
        )
        .order_by(EnergyLoad.timestamp)
    )
    all_fc = all_fc_result.scalars().all()

    if anchor_ts is None:
        hindcasts_rows = all_fc
        forecasts_rows: list = []
    else:
        hindcasts_rows = [r for r in all_fc if r.timestamp <= anchor_ts]
        forecasts_rows = [r for r in all_fc if r.timestamp > anchor_ts]

    return LoadResponse(
        zone=zone,
        actuals=[LoadPoint.model_validate(r) for r in actuals_result.scalars().all()],
        hindcasts=[LoadPoint.model_validate(r) for r in hindcasts_rows],
        forecasts=[LoadPoint.model_validate(r) for r in forecasts_rows],
    )
