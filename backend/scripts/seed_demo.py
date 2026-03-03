"""
Seed the database with 30 days of realistic synthetic energy data.
Run inside the backend container:
  docker compose exec backend python scripts/seed_demo.py
"""
import math
import random
import sys
from datetime import datetime, timedelta, timezone

# Add /app to path so imports work when run from container
sys.path.insert(0, "/app")

from app.core.database import SyncSessionLocal
from app.models.energy_price import EnergyPrice
from app.models.energy_load import EnergyLoad
from app.models.energy_production import EnergyProduction

ZONES = ["DE_LU", "FR", "ES"]
DAYS = 30
SEED = 42

random.seed(SEED)

PROD_TYPES = ["nuclear", "gas", "coal", "solar", "wind_onshore", "wind_offshore", "hydro_run_of_river"]

# Rough MW baseloads per zone per type
BASE_PRODUCTION = {
    "DE_LU": {"nuclear": 4000, "gas": 8000, "coal": 6000, "solar": 0, "wind_onshore": 10000, "wind_offshore": 2500, "hydro_run_of_river": 1200},
    "FR":    {"nuclear": 45000, "gas": 3000, "coal": 500,  "solar": 0, "wind_onshore": 6000, "wind_offshore": 200, "hydro_run_of_river": 8000},
    "ES":    {"nuclear": 7000,  "gas": 5000, "coal": 1000, "solar": 0, "wind_onshore": 12000, "wind_offshore": 0, "hydro_run_of_river": 3000},
}
BASE_LOAD = {"DE_LU": 52000, "FR": 55000, "ES": 32000}
BASE_PRICE = {"DE_LU": 80.0, "FR": 75.0, "ES": 70.0}


def _sin_hour(h: int, peak: int, amplitude: float) -> float:
    """Smooth sinusoidal profile peaking at `peak` hour."""
    return amplitude * math.sin(math.pi * (h - peak + 12) / 12) ** 2


def generate_hour(zone: str, dt: datetime):
    h = dt.hour
    noise = lambda scale: random.gauss(0, scale)

    # --- price: two daily peaks (morning 8h, evening 19h) ---
    price_daily = (
        _sin_hour(h, 8, 30)
        + _sin_hour(h, 19, 25)
        + BASE_PRICE[zone]
        + noise(8)
    )
    price = max(5.0, price_daily)

    # --- load: similar two-peak shape ---
    load_daily = (
        _sin_hour(h, 8, 8000)
        + _sin_hour(h, 19, 7000)
        + BASE_LOAD[zone]
        + noise(1000)
    )
    load = max(10000, load_daily)

    # --- production per type ---
    prods = {}
    base = BASE_PRODUCTION[zone]
    for pt in PROD_TYPES:
        b = base[pt]
        if pt == "solar":
            # Only during daylight 6-20h
            solar_mw = max(0, b + _sin_hour(h, 12, b * 1.8) + noise(b * 0.1)) if 6 <= h <= 20 else 0
            prods[pt] = solar_mw
        elif "wind" in pt:
            prods[pt] = max(0, b * random.uniform(0.3, 1.5) + noise(b * 0.15))
        elif pt == "nuclear":
            prods[pt] = max(0, b + noise(b * 0.02))  # very stable
        else:
            prods[pt] = max(0, b * random.uniform(0.5, 1.2) + noise(b * 0.1))

    return price, load, prods


def main():
    end = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=DAYS)

    prices, loads, productions = [], [], []

    for zone in ZONES:
        dt = start
        while dt <= end:
            price, load, prods = generate_hour(zone, dt)

            prices.append(EnergyPrice(
                timestamp=dt, bidding_zone=zone,
                is_forecast=False, price_eur_mwh=round(price, 2),
            ))
            loads.append(EnergyLoad(
                timestamp=dt, bidding_zone=zone,
                is_forecast=False, load_mw=round(load, 1),
            ))
            for pt, mw in prods.items():
                productions.append(EnergyProduction(
                    timestamp=dt, bidding_zone=zone,
                    production_type=pt, is_forecast=False,
                    value_mw=round(mw, 1),
                ))

            dt += timedelta(hours=1)

    total = len(prices) + len(loads) + len(productions)
    print(f"Inserting {len(prices)} prices, {len(loads)} load rows, {len(productions)} production rows "
          f"({total} total) for zones: {', '.join(ZONES)} …")

    with SyncSessionLocal() as db:
        for obj in prices + loads + productions:
            db.merge(obj)
        db.commit()

    print("Done. Database seeded successfully.")


if __name__ == "__main__":
    main()
