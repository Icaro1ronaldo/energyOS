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

    result = await db.execute(
        select(EnergyLoad)
        .where(
            EnergyLoad.bidding_zone == zone,
            EnergyLoad.timestamp >= start,
            EnergyLoad.timestamp <= end,
        )
        .order_by(EnergyLoad.timestamp)
    )
    rows = result.scalars().all()

    return LoadResponse(
        zone=zone,
        actuals=[LoadPoint.model_validate(r) for r in rows if not r.is_forecast],
        forecasts=[LoadPoint.model_validate(r) for r in rows if r.is_forecast],
    )
