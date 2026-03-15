import uuid
import pandas as pd
from .celery_app import app
from ..core.config import settings
from ..core.database import SyncSessionLocal
from ..models.energy_price import EnergyPrice
from ..models.energy_load import EnergyLoad
from ..models.energy_production import EnergyProduction, PRODUCTION_TYPES
from ..services.ml.trainer import train, generate_forecast, generate_hindcast
from ..services.ml.registry import register_model
from ..services import s3 as s3_svc


@app.task(name="app.workers.ml_forecast.run_all_forecasts")
def run_all_forecasts():
    for zone in settings.bidding_zones_list:
        try:
            _forecast_prices(zone)
        except Exception as e:
            print(f"[ml_forecast] prices {zone}: {e}")
        try:
            _forecast_load(zone)
        except Exception as e:
            print(f"[ml_forecast] load {zone}: {e}")
        for prod_type in PRODUCTION_TYPES:
            try:
                _forecast_production(zone, prod_type)
            except Exception as e:
                print(f"[ml_forecast] production {zone}/{prod_type}: {e}")


# ── Data loaders ──────────────────────────────────────────────────────────────

def _load_price_df(zone: str) -> pd.DataFrame:
    with SyncSessionLocal() as db:
        rows = (
            db.query(EnergyPrice)
            .filter(EnergyPrice.bidding_zone == zone, ~EnergyPrice.is_forecast)
            .order_by(EnergyPrice.timestamp)
            .all()
        )
    return pd.DataFrame([
        {"ds": r.timestamp, "y": float(r.price_eur_mwh)}
        for r in rows if r.price_eur_mwh is not None
    ])


def _load_load_df(zone: str) -> pd.DataFrame:
    with SyncSessionLocal() as db:
        rows = (
            db.query(EnergyLoad)
            .filter(EnergyLoad.bidding_zone == zone, ~EnergyLoad.is_forecast)
            .order_by(EnergyLoad.timestamp)
            .all()
        )
    return pd.DataFrame([
        {"ds": r.timestamp, "y": float(r.load_mw)}
        for r in rows if r.load_mw is not None
    ])


def _load_production_df(zone: str, prod_type: str) -> pd.DataFrame:
    with SyncSessionLocal() as db:
        rows = (
            db.query(EnergyProduction)
            .filter(
                EnergyProduction.bidding_zone == zone,
                EnergyProduction.production_type == prod_type,
                ~EnergyProduction.is_forecast,
            )
            .order_by(EnergyProduction.timestamp)
            .all()
        )
    return pd.DataFrame([
        {"ds": r.timestamp, "y": float(r.value_mw)}
        for r in rows if r.value_mw is not None
    ])


# ── Forecast writers ──────────────────────────────────────────────────────────

def _write_price_forecasts(zone: str, forecast_df: pd.DataFrame):
    with SyncSessionLocal() as db:
        db.query(EnergyPrice).filter(
            EnergyPrice.bidding_zone == zone, EnergyPrice.is_forecast
        ).delete()
        for _, row in forecast_df.iterrows():
            db.merge(EnergyPrice(
                timestamp=row["ds"].to_pydatetime(),
                bidding_zone=zone,
                is_forecast=True,
                price_eur_mwh=max(0.0, float(row["yhat"])),
                price_lower_eur_mwh=max(0.0, float(row["yhat_lower"])),
                price_upper_eur_mwh=max(0.0, float(row["yhat_upper"])),
            ))
        db.commit()


def _write_load_forecasts(zone: str, forecast_df: pd.DataFrame):
    with SyncSessionLocal() as db:
        db.query(EnergyLoad).filter(
            EnergyLoad.bidding_zone == zone, EnergyLoad.is_forecast
        ).delete()
        for _, row in forecast_df.iterrows():
            db.merge(EnergyLoad(
                timestamp=row["ds"].to_pydatetime(),
                bidding_zone=zone,
                is_forecast=True,
                load_mw=max(0.0, float(row["yhat"])),
            ))
        db.commit()


def _write_production_forecasts(zone: str, prod_type: str, forecast_df: pd.DataFrame):
    with SyncSessionLocal() as db:
        db.query(EnergyProduction).filter(
            EnergyProduction.bidding_zone == zone,
            EnergyProduction.production_type == prod_type,
            EnergyProduction.is_forecast,
        ).delete()
        for _, row in forecast_df.iterrows():
            db.merge(EnergyProduction(
                timestamp=row["ds"].to_pydatetime(),
                bidding_zone=zone,
                production_type=prod_type,
                is_forecast=True,
                value_mw=max(0.0, float(row["yhat"])),
            ))
        db.commit()


# ── Forecast runners ──────────────────────────────────────────────────────────

def _try_persist_model(domain: str, zone: str, model, s3_key: str, prod_type=None):
    """Upload to S3 and register. Logs a warning but does not raise if S3 is unavailable."""
    try:
        s3_svc.upload_model(model, s3_key)
        with SyncSessionLocal() as db:
            register_model(db, domain, zone, s3_key, production_type=prod_type)
    except Exception as e:
        print(f"[ml_forecast] S3 persist skipped ({domain} {zone}): {e}")


def _forecast_prices(zone: str):
    df = _load_price_df(zone)
    if len(df) < 48:
        return
    model = train(df)
    _try_persist_model("prices", zone, model, f"models/prices/{zone}/{uuid.uuid4()}.pkl")
    hindcast = generate_hindcast(model, n_days=7)
    forward  = generate_forecast(model, settings.forecast_horizon_hours)
    _write_price_forecasts(zone, pd.concat([hindcast, forward], ignore_index=True))


def _forecast_load(zone: str):
    df = _load_load_df(zone)
    if len(df) < 48:
        return
    model = train(df)
    _try_persist_model("load", zone, model, f"models/load/{zone}/{uuid.uuid4()}.pkl")
    hindcast = generate_hindcast(model, n_days=7)
    forward  = generate_forecast(model, settings.forecast_horizon_hours)
    _write_load_forecasts(zone, pd.concat([hindcast, forward], ignore_index=True))


def _forecast_production(zone: str, prod_type: str):
    df = _load_production_df(zone, prod_type)
    if len(df) < 48:
        return
    model = train(df)
    _try_persist_model("production", zone, model, f"models/production/{zone}/{prod_type}/{uuid.uuid4()}.pkl", prod_type)
    _write_production_forecasts(zone, prod_type, generate_forecast(model, settings.forecast_horizon_hours))
