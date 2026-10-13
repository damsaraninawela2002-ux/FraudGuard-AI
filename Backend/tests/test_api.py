"""End-to-end API integration tests using test MongoDB database.

FraudGuard AI – Explainable Fraud Detection System
"""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health(async_client: AsyncClient):
    """Verify health endpoint returns 200 OK and expected status payload."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "is_demo" in data


@pytest.mark.anyio
async def test_register_and_login(async_client: AsyncClient):
    """Verify user registration, login JWT token retrieval, and 409 duplicate email rejection."""
    user_payload = {
        "email": "analyst_integration@fraudguard.ai",
        "password": "SecurePassword123!",
        "full_name": "Integration Analyst",
    }

    # 1. Successful registration -> 201 Created
    reg_response = await async_client.post("/api/auth/register", json=user_payload)
    assert reg_response.status_code == 201
    user_out = reg_response.json()
    assert user_out["email"] == user_payload["email"]
    assert user_out["full_name"] == user_payload["full_name"]
    assert "password" not in user_out
    assert "hashed_password" not in user_out

    # 2. Duplicate registration -> 409 Conflict
    dup_response = await async_client.post("/api/auth/register", json=user_payload)
    assert dup_response.status_code == 409
    assert "already exists" in dup_response.json()["detail"].lower()

    # 3. Successful login -> 200 OK with Bearer token
    login_response = await async_client.post(
        "/api/auth/login",
        json={"email": user_payload["email"], "password": user_payload["password"]},
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"].lower() == "bearer"


@pytest.mark.anyio
async def test_predict_requires_auth(async_client: AsyncClient):
    """Verify POST /api/predict returns 401 Unauthorized without an access token."""
    sample_transaction = {
        "amount": 1500.0,
        "transaction_type": "PAYMENT",
        "hour_of_day": 11,
        "old_balance_origin": 3000.0,
        "new_balance_origin": 1500.0,
        "old_balance_dest": 0.0,
        "new_balance_dest": 0.0,
    }
    response = await async_client.post("/api/predict", json=sample_transaction)
    assert response.status_code == 401


@pytest.mark.anyio
async def test_predict_returns_valid_result(async_client: AsyncClient):
    """Verify authenticated prediction yields valid risk_score, risk_level, and non-empty top_features."""
    # 1. Register and login to obtain token
    user = {
        "email": "predict_user@fraudguard.ai",
        "password": "Password12345!",
        "full_name": "Predict Analyst",
    }
    await async_client.post("/api/auth/register", json=user)
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Execute prediction
    transaction_payload = {
        "amount": 250000.0,
        "transaction_type": "TRANSFER",
        "hour_of_day": 2,
        "old_balance_origin": 250000.0,
        "new_balance_origin": 0.0,
        "old_balance_dest": 0.0,
        "new_balance_dest": 250000.0,
    }


    response = await async_client.post(
        "/api/predict",
        json=transaction_payload,
        headers=auth_headers,
    )
    assert response.status_code == 200
    result = response.json()

    # Validate output fields
    assert result["transaction_id"].startswith("TXN")
    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["risk_level"] in ["Low", "Medium", "High"]
    assert result["prediction"] in ["Potential Fraud", "Likely Legitimate"]

    # Verify top_features is not empty and contains valid contributions
    assert isinstance(result["top_features"], list)
    assert len(result["top_features"]) > 0
    for feature in result["top_features"]:
        assert "feature" in feature
        assert "shap_value" in feature
        assert feature["direction"] in ["increases_risk", "decreases_risk"]


@pytest.mark.anyio
async def test_invalid_input(async_client: AsyncClient):
    """Verify negative amount returns 422 Unprocessable Entity."""
    # Register and login
    user = {
        "email": "invalid_input_user@fraudguard.ai",
        "password": "Password12345!",
        "full_name": "Test User",
    }
    await async_client.post("/api/auth/register", json=user)
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Negative amount payload (violates gt=0.0 schema constraint)
    invalid_payload = {
        "amount": -500.0,
        "transaction_type": "TRANSFER",
        "hour_of_day": 14,
        "old_balance_origin": 1000.0,
        "new_balance_origin": 500.0,
        "old_balance_dest": 0.0,
        "new_balance_dest": 500.0,
    }

    response = await async_client.post(
        "/api/predict",
        json=invalid_payload,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_transactions_pagination(async_client: AsyncClient):
    """Verify transactions listing pagination and filtering by risk level, prediction, and search."""
    # 1. Authenticate user
    user = {
        "email": "pagination_user@fraudguard.ai",
        "password": "Password12345!",
        "full_name": "Pagination Analyst",
    }
    await async_client.post("/api/auth/register", json=user)
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Seed multiple transactions
    transactions_data = [
        # Likely high risk transfer
        {
            "amount": 300000.0,
            "transaction_type": "TRANSFER",
            "hour_of_day": 2,
            "old_balance_origin": 300000.0,
            "new_balance_origin": 0.0,
            "old_balance_dest": 0.0,
            "new_balance_dest": 300000.0,
        },
        # Legitimate routine payment
        {
            "amount": 25.0,
            "transaction_type": "PAYMENT",
            "hour_of_day": 15,
            "old_balance_origin": 1000.0,
            "new_balance_origin": 975.0,
            "old_balance_dest": 0.0,
            "new_balance_dest": 0.0,
        },
        # Small cash in
        {
            "amount": 50.0,
            "transaction_type": "CASH_IN",
            "hour_of_day": 11,
            "old_balance_origin": 500.0,
            "new_balance_origin": 550.0,
            "old_balance_dest": 0.0,
            "new_balance_dest": 0.0,
        },
    ]

    created_ids = []
    for tx in transactions_data:
        res = await async_client.post("/api/predict", json=tx, headers=auth_headers)
        assert res.status_code == 200
        created_ids.append(res.json()["transaction_id"])

    # 3. Test pagination: page 1 with page_size=2
    page1_res = await async_client.get(
        "/api/transactions?page=1&page_size=2",
        headers=auth_headers,
    )
    assert page1_res.status_code == 200
    page1_data = page1_res.json()

    assert page1_data["total"] == 3
    assert page1_data["page"] == 1
    assert page1_data["page_size"] == 2
    assert len(page1_data["items"]) == 2

    # Test pagination: page 2 with page_size=2
    page2_res = await async_client.get(
        "/api/transactions?page=2&page_size=2",
        headers=auth_headers,
    )
    assert page2_res.status_code == 200
    page2_data = page2_res.json()
    assert page2_data["total"] == 3
    assert page2_data["page"] == 2
    assert len(page2_data["items"]) == 1

    # 4. Test filter by search (exact transaction_id)
    target_txn = created_ids[0]
    search_res = await async_client.get(
        f"/api/transactions?search={target_txn}",
        headers=auth_headers,
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data["items"]) == 1
    assert search_data["items"][0]["transaction_id"] == target_txn

    # 5. Test filter by risk_level
    sample_risk = page1_data["items"][0]["risk_level"]
    risk_res = await async_client.get(
        f"/api/transactions?risk_level={sample_risk}",
        headers=auth_headers,
    )
    assert risk_res.status_code == 200
    for item in risk_res.json()["items"]:
        assert item["risk_level"] == sample_risk

    # 6. Test filter by prediction
    sample_pred = page1_data["items"][0]["prediction"]
    pred_res = await async_client.get(
        f"/api/transactions?prediction={sample_pred}",
        headers=auth_headers,
    )
    assert pred_res.status_code == 200
    for item in pred_res.json()["items"]:
        assert item["prediction"] == sample_pred
