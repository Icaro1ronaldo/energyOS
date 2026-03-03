from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.database import get_async_db
from ...models.energy_production import EnergyProduction
from ...schemas.production import ProductionPoint, ProductionResponse

router = APIRouter()


@router.get("/{zone}", response_model=list[ProductionResponse])
async def get_all_production(
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
        select(EnergyProduction)
        .where(
            EnergyProduction.bidding_zone == zone,
            EnergyProduction.timestamp >= start,
            EnergyProduction.timestamp <= end,
        )
        .order_by(EnergyProduction.production_type, EnergyProduction.timestamp)
    )
    rows = result.scalars().all()

    by_type: dict[str, dict] = {}
    for r in rows:
        if r.production_type not in by_type:
            by_type[r.production_type] = {"actuals": [], "forecasts": []}
        point = ProductionPoint.model_validate(r)
        if r.is_forecast:
            by_type[r.production_type]["forecasts"].append(point)
        else:
            by_type[r.production_type]["actuals"].append(point)

    return [
        ProductionResponse(zone=zone, production_type=pt, **data)
        for pt, data in by_type.items()
    ]


@router.get("/{zone}/{production_type}", response_model=ProductionResponse)
async def get_production_by_type(
    zone: str,
    production_type: str,
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    if end is None:
        end = datetime.now(timezone.utc)
    if start is None:
        start = end - timedelta(days=7)

    result = await db.execute(
        select(EnergyProduction)
        .where(
            EnergyProduction.bidding_zone == zone,
            EnergyProduction.production_type == production_type,
            EnergyProduction.timestamp >= start,
            EnergyProduction.timestamp <= end,
        )
        .order_by(EnergyProduction.timestamp)
    )
    rows = result.scalars().all()

    return ProductionResponse(
        zone=zone,
        production_type=production_type,
        actuals=[ProductionPoint.model_validate(r) for r in rows if not r.is_forecast],
        forecasts=[ProductionPoint.model_validate(r) for r in rows if r.is_forecast],
    )
