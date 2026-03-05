import pandas as pd
from datetime import datetime, timedelta, timezone
from .celery_app import app
from ..core.config import settings
from ..core.database import SyncSessionLocal
from ..models.energy_price import EnergyPrice
from ..models.energy_load import EnergyLoad
from ..models.energy_production import EnergyProduction
from ..services import entsoe as entsoe_svc
from ..services.pubsub import publish, CHANNEL_PRICES, CHANNEL_LOAD, CHANNEL_PRODUCTION


def _ts(dt: datetime) -> pd.Timestamp:
    return pd.Timestamp(dt).tz_localize("UTC") if dt.tzinfo is None else pd.Timestamp(dt)


@app.task(name="app.workers.ingestion.ingest_all")
def ingest_all():
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=1)

    for zone in settings.bidding_zones_list:
        try:
            _ingest_prices(zone, start, end)
        except Exception as e:
            print(f"[ingestion] prices {zone}: {e}")
        try:
            _ingest_load(zone, start, end)
        except Exception as e:
            print(f"[ingestion] load {zone}: {e}")
        try:
            _ingest_production(zone, start, end)
        except Exception as e:
            print(f"[ingestion] production {zone}: {e}")


def _to_dt(ts) -> "datetime":
    t = pd.Timestamp(ts)
    if t.tzinfo is None:
        t = t.tz_localize("UTC")
    return t.tz_convert("UTC").to_pydatetime()


def _col_to_type(col) -> str:
    raw = col[0] if isinstance(col, tuple) else col
    return str(raw).lower().replace(" ", "_").replace("-", "_").replace("/", "_")[:50]


def _ingest_prices(zone: str, start: datetime, end: datetime):
    series = entsoe_svc.fetch_prices(zone, _ts(start), _ts(end))
    with SyncSessionLocal() as db:
        for ts, price in series.items():
            db.merge(EnergyPrice(
                timestamp=_to_dt(ts),
                bidding_zone=zone,
                is_forecast=False,
                price_eur_mwh=float(price),
            ))
        db.commit()
    publish(CHANNEL_PRICES, {"zone": zone, "domain": "prices"})


def _ingest_load(zone: str, start: datetime, end: datetime):
    series = entsoe_svc.fetch_load(zone, _ts(start), _ts(end))
    with SyncSessionLocal() as db:
        for ts, load in series.items():
            db.merge(EnergyLoad(
                timestamp=_to_dt(ts),
                bidding_zone=zone,
                is_forecast=False,
                load_mw=float(load),
            ))
        db.commit()
    publish(CHANNEL_LOAD, {"zone": zone, "domain": "load"})


def _ingest_production(zone: str, start: datetime, end: datetime):
    df = entsoe_svc.fetch_generation(zone, _ts(start), _ts(end))
    if df is None or df.empty:
        return
    with SyncSessionLocal() as db:
        for ts, row_data in df.iterrows():
            for col in df.columns:
                prod_type = _col_to_type(col)
                val = row_data[col]
                if pd.isna(val):
                    continue
                db.merge(EnergyProduction(
                    timestamp=_to_dt(ts),
                    bidding_zone=zone,
                    production_type=prod_type,
                    is_forecast=False,
                    value_mw=float(val),
                ))
        db.commit()
    publish(CHANNEL_PRODUCTION, {"zone": zone, "domain": "production"})
