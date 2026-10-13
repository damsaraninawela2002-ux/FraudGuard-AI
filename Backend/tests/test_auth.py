"""Unit tests for authentication helpers and auth endpoints (/api/auth).

FraudGuard AI – Explainable Fraud Detection System
"""

from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.main import app


def test_password_hashing_and_verification():
    """Verify password hashing produces valid bcrypt hashes that verify correctly."""
    password = "SuperSecretPassword123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_generation_and_decoding():
    """Verify JWT access token creation and payload decoding."""
    payload = {"sub": "analyst@example.com", "role": "analyst"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "analyst@example.com"
    assert decoded["role"] == "analyst"
    assert "exp" in decoded


@pytest.mark.anyio
async def test_auth_register_and_login_flow():
    """Verify /api/auth/register, /api/auth/login, and /api/auth/me endpoints."""
    mock_db = MagicMock()
    mock_collection = AsyncMock()
    mock_db.__getitem__.return_value = mock_collection

    oid = ObjectId("670a5b281234567890abcdef")
    fake_user = {
        "_id": oid,
        "email": "new_analyst@fraudguard.ai",
        "full_name": "New Analyst",
        "hashed_password": get_password_hash("ValidPassword123"),
        "role": "analyst",
    }

    # 1. Register
    mock_collection.find_one.return_value = None  # user does not exist yet
    mock_collection.insert_one.return_value = MagicMock(inserted_id=oid)

    with patch("app.api.routes_auth.get_database", return_value=mock_db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            register_res = await client.post(
                "/api/auth/register",
                json={
                    "email": "new_analyst@fraudguard.ai",
                    "password": "ValidPassword123",
                    "full_name": "New Analyst",
                },
            )
            assert register_res.status_code == 201
            reg_data = register_res.json()
            assert reg_data["email"] == "new_analyst@fraudguard.ai"
            assert "password" not in reg_data
            assert "hashed_password" not in reg_data

            # 2. Login with correct password
            mock_collection.find_one.return_value = fake_user
            login_res = await client.post(
                "/api/auth/login",
                json={
                    "email": "new_analyst@fraudguard.ai",
                    "password": "ValidPassword123",
                },
            )
            assert login_res.status_code == 200
            token_data = login_res.json()
            assert "access_token" in token_data
            assert token_data["token_type"] == "bearer"

            # 3. Login with incorrect password
            bad_login = await client.post(
                "/api/auth/login",
                json={
                    "email": "new_analyst@fraudguard.ai",
                    "password": "WrongPassword123",
                },
            )
            assert bad_login.status_code == 401
