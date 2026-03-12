"""
Standalone backfill runner — executes directly inside the backend container,
no Celery worker required.

Usage:
    # 2-year backfill (default)
    docker compose exec backend python -m app.workers.backfill_runner

    # Custom year count
    docker compose exec backend python -m app.workers.backfill_runner --years 3

    # Custom date range
    docker compose exec backend python -m app.workers.backfill_runner \
        --start 2024-01-01 --end 2026-03-12

    # Specific zones only
    docker compose exec backend python -m app.workers.backfill_runner \
        --start 2025-03-01 --end 2026-03-12 --zones FR DE_LU BE
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from .backfill import _run
from ..core.config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="EnergyOS historical data backfill")
    parser.add_argument("--years",  type=int,   default=2,    help="Years of history (default: 2)")
    parser.add_argument("--start",  type=str,   default=None, help="Start date YYYY-MM-DD (overrides --years)")
    parser.add_argument("--end",    type=str,   default=None, help="End date   YYYY-MM-DD (default: today)")
    parser.add_argument("--zones",  nargs="+",  default=None, help="Zone codes (default: all configured zones)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)

    if args.end:
        end = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc)
    else:
        end = now

    if args.start:
        start = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    else:
        start = end - timedelta(days=365 * args.years)

    zones = args.zones or settings.bidding_zones_list

    print("=" * 60)
    print(f"  EnergyOS Historical Backfill")
    print(f"  Period : {start.date()} → {end.date()}")
    print(f"  Zones  : {', '.join(zones)}")
    print(f"  Chunks : 7-day windows, up to 3 retries each")
    print("=" * 60)

    results = _run(start, end, zones)

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    total_ok = total_err = 0
    for zone, stats in results.items():
        status = "✓" if stats["err"] == 0 else "⚠"
        print(f"  {status}  {zone:<10}  {stats['ok']} chunks ok, {stats['err']} failed")
        total_ok  += stats["ok"]
        total_err += stats["err"]
    print("-" * 60)
    print(f"     Total      {total_ok} ok, {total_err} failed")
    print("=" * 60)

    sys.exit(1 if total_err > 0 else 0)


if __name__ == "__main__":
    main()
