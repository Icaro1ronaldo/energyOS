import pytest
from datetime import datetime, timezone
from app.models.energy_price import EnergyPrice


@pytest.mark.asyncio
async def test_prices_empty(client):
    """Returns empty lists when no data exists."""
    response = await client.get("/api/v1/prices/DE_LU")
    assert response.status_code == 200
    data = response.json()
    assert data["zone"] == "DE_LU"
    assert data["actuals"] == []
    assert data["forecasts"] == []


@pytest.mark.asyncio
async def test_prices_returns_data(client, db_session):
    """Returns rows that were inserted for the requested zone."""
    ts = datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc)
    db_session.add(EnergyPrice(
        timestamp=ts, bidding_zone="DE_LU",
        is_forecast=False, price_eur_mwh=85.50,
    ))
    await db_session.commit()

    response = await client.get(
        "/api/v1/prices/DE_LU",
        params={"start": "2025-06-01T00:00:00Z", "end": "2025-06-02T00:00:00Z"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["actuals"]) == 1
    assert float(data["actuals"][0]["price_eur_mwh"]) == pytest.approx(85.50)


@pytest.mark.asyncio
async def test_prices_wrong_zone_returns_empty(client, db_session):
    """Data for DE_LU is not returned when querying FR."""
    ts = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)
    db_session.add(EnergyPrice(
        timestamp=ts, bidding_zone="DE_LU",
        is_forecast=False, price_eur_mwh=90.0,
    ))
    await db_session.commit()

    response = await client.get(
        "/api/v1/prices/FR",
        params={"start": "2025-06-01T00:00:00Z", "end": "2025-06-02T00:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["actuals"] == []
