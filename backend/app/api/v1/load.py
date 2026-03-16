from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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

    # Forecasts: return ALL rows — not filtered by date because the ML writer
    # anchors the forecast window at the last actual, which may be older than
    # the user's selected view range.
    forecasts_result = await db.execute(
        select(EnergyLoad)
        .where(
            EnergyLoad.bidding_zone == zone,
            EnergyLoad.is_forecast,
        )
        .order_by(EnergyLoad.timestamp)
    )

    return LoadResponse(
        zone=zone,
        actuals=[LoadPoint.model_validate(r) for r in actuals_result.scalars().all()],
        forecasts=[LoadPoint.model_validate(r) for r in forecasts_result.scalars().all()],
    )
