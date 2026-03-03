import pytest
from datetime import datetime, timezone
from app.models.energy_load import EnergyLoad


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
