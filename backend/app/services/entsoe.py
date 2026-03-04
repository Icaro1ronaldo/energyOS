import pandas as pd
from entsoe import EntsoePandasClient
from ..core.config import settings

# Map our zone identifiers to entsoe-py area codes
ZONE_MAP: dict[str, str] = {
    "DE_LU": "DE_LU",
    "FR": "FR",
    "ES": "ES",
    "PT": "PT",
    "NL": "NL",
    "BE": "BE",
    "AT": "AT",
    "IT_NORTH": "IT_NORTH",
    "PL": "PL",
    "DK_1": "DK_1",
    "DK_2": "DK_2",
    "SE_1": "SE_1",
    "SE_2": "SE_2",
    "SE_3": "SE_3",
    "SE_4": "SE_4",
}


def _client() -> EntsoePandasClient:
    return EntsoePandasClient(api_key=settings.entsoe_token)


def _area(zone: str) -> str:
    return ZONE_MAP.get(zone, zone)


def fetch_prices(zone: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Day-ahead market prices (€/MWh) for the given bidding zone and period.

    Tries 15min first (most granular), then 60min, then 30min.
    DE_LU and ES switched to 15-min day-ahead prices in 2024/2025.
    Trying 60min first returns partial data for mixed-resolution windows
    without raising an error, so we must start with the finest resolution.
    """
    client = _client()
    area = _area(zone)
    for res in ("15min", "60min", "30min"):
        try:
            return client.query_day_ahead_prices(area, start=start, end=end, resolution=res)
        except Exception:
            continue
    # all resolutions failed — re-raise the last error
    return client.query_day_ahead_prices(area, start=start, end=end, resolution="60min")


def fetch_load(zone: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Actual total load (MW) for the given bidding zone and period."""
    result = _client().query_load(_area(zone), start=start, end=end)
    # query_load returns a DataFrame with an 'Actual Load' column
    if isinstance(result, pd.DataFrame):
        col = "Actual Load" if "Actual Load" in result.columns else result.columns[0]
        return result[col]
    return result


def fetch_generation(zone: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Actual generation per production type (MW) for the given period."""
    return _client().query_generation(_area(zone), start=start, end=end, psr_type=None)
