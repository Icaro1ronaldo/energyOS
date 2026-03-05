import pytest
import pandas as pd
from datetime import datetime, timezone
from unittest.mock import patch
from app.models.energy_load import EnergyLoad
from app.services.entsoe import fetch_load


# ── Unit tests for fetch_load (no real API calls) ─────────────────────────────

def _make_series(values: dict) -> pd.Series:
    idx = pd.DatetimeIndex(list(values.keys()), tz="UTC")
    return pd.Series(list(values.values()), index=idx)


def test_fetch_load_returns_series_when_api_returns_series():
    """query_load already returns a Series — fetch_load passes it through."""
    fake = _make_series({"2026-03-01 00:00": 42000.0, "2026-03-01 01:00": 43000.0})
    with patch("app.services.entsoe._client") as mock_client:
        mock_client.return_value.query_load.return_value = fake
        result = fetch_load("DE_LU",
                            pd.Timestamp("2026-03-01", tz="UTC"),
                            pd.Timestamp("2026-03-02", tz="UTC"))
    assert isinstance(result, pd.Series)
    assert len(result) == 2
    assert result.iloc[0] == pytest.approx(42000.0)


def test_fetch_load_extracts_actual_load_column_from_dataframe():
    """query_load sometimes returns a DataFrame — fetch_load extracts the right column."""
    idx = pd.DatetimeIndex(["2026-03-01 00:00", "2026-03-01 01:00"], tz="UTC")
    fake_df = pd.DataFrame({"Actual Load": [50000.0, 51000.0]}, index=idx)
    with patch("app.services.entsoe._client") as mock_client:
        mock_client.return_value.query_load.return_value = fake_df
        result = fetch_load("FR",
                            pd.Timestamp("2026-03-01", tz="UTC"),
                            pd.Timestamp("2026-03-02", tz="UTC"))
    assert isinstance(result, pd.Series)
    assert result.iloc[1] == pytest.approx(51000.0)


def test_fetch_load_falls_back_to_first_column_if_no_actual_load():
    """When 'Actual Load' column is absent, fetch_load uses the first column."""
    idx = pd.DatetimeIndex(["2026-03-01 00:00"], tz="UTC")
    fake_df = pd.DataFrame({"Total Load Interpolated": [38000.0]}, index=idx)
    with patch("app.services.entsoe._client") as mock_client:
        mock_client.return_value.query_load.return_value = fake_df
        result = fetch_load("ES",
                            pd.Timestamp("2026-03-01", tz="UTC"),
                            pd.Timestamp("2026-03-02", tz="UTC"))
    assert result.iloc[0] == pytest.approx(38000.0)


# ── API endpoint integration tests (in-memory DB, no real API) ────────────────

@pytest.mark.asyncio
async def test_load_empty(client):
    response = await client.get("/api/v1/load/DE_LU")
    assert response.status_code == 200
    data = response.json()
    assert data["zone"] == "DE_LU"
    assert data["actuals"] == []
    assert data["forecasts"] == []


@pytest.mark.asyncio
async def test_load_returns_data(client, db_session):
    ts = datetime(2025, 7, 15, 10, 0, tzinfo=timezone.utc)
    db_session.add(EnergyLoad(
        timestamp=ts, bidding_zone="DE_LU",
        is_forecast=False, load_mw=45000.0,
    ))
    await db_session.commit()

    response = await client.get(
        "/api/v1/load/DE_LU",
        params={"start": "2025-07-15T00:00:00Z", "end": "2025-07-16T00:00:00Z"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["actuals"]) == 1
    assert float(data["actuals"][0]["load_mw"]) == pytest.approx(45000.0)
