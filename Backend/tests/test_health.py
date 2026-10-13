import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.anyio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        data = response.json()
        assert data["status"] == "ok"
        assert "is_demo" in data


@pytest.mark.anyio
async def test_health_db_connected():
    mock_db = AsyncMock()
    mock_db.command.return_value = {"ok": 1}

    with patch("app.main.get_database", return_value=mock_db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health/db")
            assert response.status_code == 200
            assert response.json() == {"status": "ok", "database": "connected"}


@pytest.mark.anyio
async def test_health_db_unreachable():
    mock_db = AsyncMock()
    mock_db.command.side_effect = Exception("Connection timed out")

    with patch("app.main.get_database", return_value=mock_db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health/db")
            assert response.status_code == 503
            assert "Database unreachable" in response.json()["detail"]


@pytest.mark.anyio
async def test_unhandled_exception_handler():
    with patch("app.main.get_ml_service", side_effect=RuntimeError("Unexpected internal crash")):
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 500
            assert response.json() == {"detail": "An internal server error occurred."}

