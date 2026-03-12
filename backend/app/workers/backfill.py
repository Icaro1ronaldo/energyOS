"""
Historical backfill worker.

Usage (via Celery):
    # Full 2-year backfill
    celery -A app.workers.celery_app call app.workers.backfill.run_backfill

    # Custom year count
    celery -A app.workers.celery_app call app.workers.backfill.run_backfill \
        --args='[3]'

    # Custom date range
    celery -A app.workers.celery_app call app.workers.backfill.run_backfill_range \
        --args='["2024-01-01", "2026-03-12"]'

Usage (direct Python, no Celery needed):
    docker compose exec backend python -m app.workers.backfill_runner
"""

import time
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from .celery_app import app
from ..core.config import settings
from ..core.database import SyncSessionLocal
from ..models.energy_price import EnergyPrice
from ..models.energy_load import EnergyLoad
from ..models.energy_production import EnergyProduction
from ..services import entsoe as entsoe_svc

# ── Chunk size: 7 days is the sweet-spot for ENTSO-E reliability.
# 30-day windows occasionally time-out or return partial data.
CHUNK_DAYS   = 7
MAX_RETRIES  = 3
RETRY_BACKOFF = [5, 15, 45]   # seconds between retries
# Run up to 3 zones in parallel — enough to get ~3× speedup without
# hammering the ENTSO-E API (which rate-limits at ~10 req/s).
ZONE_WORKERS = 3


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ts(dt: datetime) -> pd.Timestamp:
    t = pd.Timestamp(dt)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")


def _to_dt(ts) -> datetime:
    t = pd.Timestamp(ts)
    if t.tzinfo is None:
        t = t.tz_localize("UTC")
    return t.tz_convert("UTC").to_pydatetime()


def _col_to_type(col) -> str:
    raw = col[0] if isinstance(col, tuple) else col
    return str(raw).lower().replace(" ", "_").replace("-", "_").replace("/", "_")[:50]


def _retry(fn, zone, start, end, label: str) -> bool:
    """Call fn(zone, start, end), retrying up to MAX_RETRIES times. Returns True on success."""
    for attempt in range(MAX_RETRIES):
        try:
            fn(zone, start, end)
            return True
        except Exception as exc:
            wait = RETRY_BACKOFF[attempt] if attempt < len(RETRY_BACKOFF) else RETRY_BACKOFF[-1]
            print(
                f"[backfill] {label} {zone} {start.date()}–{end.date()} "
                f"attempt {attempt + 1}/{MAX_RETRIES} failed: {exc}"
                + (f" — retrying in {wait}s" if attempt < MAX_RETRIES - 1 else " — giving up")
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    return False


# ── Domain functions ───────────────────────────────────────────────────────────

def _prices(zone: str, start: datetime, end: datetime) -> None:
    series = entsoe_svc.fetch_prices(zone, _ts(start), _ts(end))
    if series is None or series.empty:
        return
    with SyncSessionLocal() as db:
        for ts, price in series.items():
            if pd.isna(price):
                continue
            db.merge(EnergyPrice(
                timestamp=_to_dt(ts), bidding_zone=zone,
                is_forecast=False, price_eur_mwh=float(price),
            ))
        db.commit()


def _load(zone: str, start: datetime, end: datetime) -> None:
    series = entsoe_svc.fetch_load(zone, _ts(start), _ts(end))
    if series is not None and not (hasattr(series, "empty") and series.empty):
        with SyncSessionLocal() as db:
            for ts, load in series.items():
                if pd.isna(load):
                    continue
                db.merge(EnergyLoad(
                    timestamp=_to_dt(ts), bidding_zone=zone,
                    is_forecast=False, load_mw=float(load),
                ))
            db.commit()

    try:
        forecast = entsoe_svc.fetch_load_forecast(zone, _ts(start), _ts(end))
        if forecast is not None and not (hasattr(forecast, "empty") and forecast.empty):
            with SyncSessionLocal() as db:
                for ts, load in forecast.items():
                    if pd.isna(load):
                        continue
                    db.merge(EnergyLoad(
                        timestamp=_to_dt(ts), bidding_zone=zone,
                        is_forecast=True, load_mw=float(load),
                    ))
                db.commit()
    except Exception as exc:
        print(f"[backfill] load forecast {zone} {start}–{end} skipped: {exc}")


def _production(zone: str, start: datetime, end: datetime) -> None:
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
                    timestamp=_to_dt(ts), bidding_zone=zone,
                    production_type=prod_type, is_forecast=False, value_mw=float(val),
                ))
        db.commit()


# ── Per-zone worker (runs in its own thread) ───────────────────────────────────

def _backfill_zone(zone: str, start: datetime, end: datetime) -> dict:
    chunk = timedelta(days=CHUNK_DAYS)
    ok = err = 0
    cursor = start
    total_chunks = max(1, int((end - start).total_seconds() / chunk.total_seconds()))
    done = 0
    print(f"[backfill] ── {zone}: {start.date()} → {end.date()} ({total_chunks} chunks) ──")

    while cursor < end:
        chunk_end = min(cursor + chunk, end)
        done += 1
        pct = int(done / total_chunks * 100)
        print(f"[backfill] {zone} [{pct:3d}%] {cursor.date()} → {chunk_end.date()}")

        for label, fn in [("prices", _prices), ("load", _load), ("production", _production)]:
            if _retry(fn, zone, cursor, chunk_end, label):
                ok += 1
            else:
                err += 1

        cursor = chunk_end
        time.sleep(0.5)   # gentle pause per chunk

    print(f"[backfill] {zone} done — {ok} ok, {err} errors")
    return {"ok": ok, "err": err}


# ── Core backfill logic (shared by both tasks) ─────────────────────────────────

def _run(start: datetime, end: datetime, zones: list[str]) -> dict:
    results: dict[str, dict[str, int]] = {}

    with ThreadPoolExecutor(max_workers=ZONE_WORKERS, thread_name_prefix="backfill") as pool:
        futures = {pool.submit(_backfill_zone, zone, start, end): zone for zone in zones}
        for future in as_completed(futures):
            zone = futures[future]
            try:
                results[zone] = future.result()
            except Exception as exc:
                print(f"[backfill] {zone} thread crashed: {exc}")
                results[zone] = {"ok": 0, "err": -1}

    return results


# ── Celery tasks ───────────────────────────────────────────────────────────────

@app.task(name="app.workers.backfill.run_backfill", bind=True, max_retries=0)
def run_backfill(self, years: int = 2):
    """Full historical backfill for the past N years (default 2).

    Run once after deploy:
        celery -A app.workers.celery_app call app.workers.backfill.run_backfill
    """
    end   = datetime.now(timezone.utc)
    start = end - timedelta(days=365 * years)
    zones = settings.bidding_zones_list
    print(f"[backfill] starting {years}-year backfill for zones: {zones}")
    results = _run(start, end, zones)
    print(f"[backfill] ── COMPLETE ── {results}")
    return results


@app.task(name="app.workers.backfill.run_backfill_range", bind=True, max_retries=0)
def run_backfill_range(self, start_date: str, end_date: str, zones: list[str] | None = None):
    """Backfill a specific date range (YYYY-MM-DD strings).

    Example:
        celery -A app.workers.celery_app call app.workers.backfill.run_backfill_range \
            --args='["2024-03-01", "2026-03-12"]'
    """
    start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    end   = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
    zone_list = zones or settings.bidding_zones_list
    print(f"[backfill] range {start.date()} → {end.date()} for zones: {zone_list}")
    results = _run(start, end, zone_list)
    print(f"[backfill] ── COMPLETE ── {results}")
    return results
