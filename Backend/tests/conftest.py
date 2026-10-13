"""Pytest configuration and test database fixtures.

FraudGuard AI – Explainable Fraud Detection System
"""

import asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient
import motor.motor_asyncio
import pytest

from app.core.config import get_settings
from app.db.mongodb import mongodb_manager
from app.main import app

# Isolated database name strictly used for testing
TEST_DB_NAME = "fraudguard_test_db"


@pytest.fixture(scope="session")
def anyio_backend():
    """Ensure anyio uses asyncio event loop."""
    return "asyncio"


@pytest.fixture
async def test_db():
    """Configure separate test database for tests and cleanly drop it after run."""
    settings = get_settings()

    # Attempt to connect to real MongoDB if available; fallback to in-memory AsyncMongoMockClient
    client = None
    try:
        real_client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=500,
        )
        await real_client.admin.command("ping")
        client = real_client
    except Exception:
        client = AsyncMongoMockClient()

    test_database = client[TEST_DB_NAME]
    mongodb_manager.client = client
    mongodb_manager.database = test_database

    # Create test indexes
    try:
        await test_database["users"].create_index("email", unique=True)
        await test_database["transactions"].create_index("createdAt")
        await test_database["transactions"].create_index("riskLevel")
    except Exception:
        pass

    yield test_database

    # Clean up and drop the test database after the test
    try:
        await client.drop_database(TEST_DB_NAME)
    except Exception:
        try:
            await test_database["users"].delete_many({})
            await test_database["transactions"].delete_many({})
        except Exception:
            pass
    finally:
        if hasattr(client, "close"):
            client.close()


@pytest.fixture
async def async_client(test_db) -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous httpx client connected to the FastAPI app with test DB."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client


@pytest.fixture
def test_client(test_db) -> TestClient:
    """Provide a synchronous FastAPI TestClient with test DB."""
    return TestClient(app)
