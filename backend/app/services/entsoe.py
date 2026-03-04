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
    """Day-ahead market prices (€/MWh) for the given bidding zone and period."""
    return _client().query_day_ahead_prices(_area(zone), start=start, end=end)


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
