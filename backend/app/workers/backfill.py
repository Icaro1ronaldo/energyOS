import pandas as pd
from datetime import datetime, timedelta, timezone
from .celery_app import app
from ..core.config import settings
from ..core.database import SyncSessionLocal
from ..models.energy_price import EnergyPrice
from ..models.energy_load import EnergyLoad
from ..models.energy_production import EnergyProduction
from ..services import entsoe as entsoe_svc


def _ts(dt: datetime) -> pd.Timestamp:
    ts = pd.Timestamp(dt)
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")


@app.task(name="app.workers.backfill.run_backfill")
def run_backfill(years: int = 2):
    """
    Seed historical actuals for the past `years` years.
    Run once manually after the first deploy:
        celery -A app.workers.celery_app call app.workers.backfill.run_backfill
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=365 * years)
    chunk = timedelta(days=30)

    for zone in settings.bidding_zones_list:
        print(f"[backfill] starting {zone}")
        cursor = start
        while cursor < end:
            chunk_end = min(cursor + chunk, end)
            try:
                _prices(zone, cursor, chunk_end)
            except Exception as e:
                print(f"[backfill] prices {zone} {cursor}–{chunk_end}: {e}")
            try:
                _load(zone, cursor, chunk_end)
            except Exception as e:
                print(f"[backfill] load {zone} {cursor}–{chunk_end}: {e}")
            try:
                _production(zone, cursor, chunk_end)
            except Exception as e:
                print(f"[backfill] production {zone} {cursor}–{chunk_end}: {e}")
            cursor = chunk_end
        print(f"[backfill] done {zone}")


def _prices(zone, start, end):
    series = entsoe_svc.fetch_prices(zone, _ts(start), _ts(end))
    with SyncSessionLocal() as db:
        for ts, price in series.items():
            db.merge(EnergyPrice(
                timestamp=ts.to_pydatetime(), bidding_zone=zone,
                is_forecast=False, price_eur_mwh=float(price),
            ))
        db.commit()


def _load(zone, start, end):
    series = entsoe_svc.fetch_load(zone, _ts(start), _ts(end))
    with SyncSessionLocal() as db:
        for ts, load in series.items():
            db.merge(EnergyLoad(
                timestamp=ts.to_pydatetime(), bidding_zone=zone,
                is_forecast=False, load_mw=float(load),
            ))
        db.commit()


def _production(zone, start, end):
    df = entsoe_svc.fetch_generation(zone, _ts(start), _ts(end))
    if df is None or df.empty:
        return
    with SyncSessionLocal() as db:
        for ts, row_data in df.iterrows():
            for col in df.columns:
                prod_type = str(col).lower().replace(" ", "_").replace("-", "_")
                val = row_data[col]
                if pd.isna(val):
                    continue
                db.merge(EnergyProduction(
                    timestamp=ts.to_pydatetime(), bidding_zone=zone,
                    production_type=prod_type, is_forecast=False, value_mw=float(val),
                ))
        db.commit()
