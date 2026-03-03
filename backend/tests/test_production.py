import pytest
from datetime import datetime, timezone
from app.models.energy_production import EnergyProduction


@pytest.mark.asyncio
async def test_production_empty(client):
    response = await client.get("/api/v1/production/DE_LU")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_production_returns_data(client, db_session):
    ts = datetime(2025, 8, 1, 6, 0, tzinfo=timezone.utc)
    db_session.add(EnergyProduction(
        timestamp=ts, bidding_zone="DE_LU",
        production_type="solar", is_forecast=False, value_mw=12000.0,
    ))
    db_session.add(EnergyProduction(
        timestamp=ts, bidding_zone="DE_LU",
        production_type="wind_onshore", is_forecast=False, value_mw=8000.0,
    ))
    await db_session.commit()

    response = await client.get(
        "/api/v1/production/DE_LU",
        params={"start": "2025-08-01T00:00:00Z", "end": "2025-08-02T00:00:00Z"},
    )
    assert response.status_code == 200
    results = response.json()
    types_returned = {r["production_type"] for r in results}
    assert "solar" in types_returned
    assert "wind_onshore" in types_returned


@pytest.mark.asyncio
async def test_production_single_type(client, db_session):
    ts = datetime(2025, 8, 2, 6, 0, tzinfo=timezone.utc)
    db_session.add(EnergyProduction(
        timestamp=ts, bidding_zone="DE_LU",
        production_type="nuclear", is_forecast=False, value_mw=5000.0,
    ))
    await db_session.commit()

    response = await client.get(
        "/api/v1/production/DE_LU/nuclear",
        params={"start": "2025-08-02T00:00:00Z", "end": "2025-08-03T00:00:00Z"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["production_type"] == "nuclear"
    assert len(data["actuals"]) == 1
    assert float(data["actuals"][0]["value_mw"]) == pytest.approx(5000.0)
