"""Unit tests for the Prediction route (/api/predict).

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient
import pytest

from app.core.security import get_current_user
from app.main import app

SAMPLE_USER = {
    "_id": "670a5b281234567890abcdef",
    "id": "670a5b281234567890abcdef",
    "email": "analyst@fraudguard.ai",
    "full_name": "Compliance Analyst",
    "role": "analyst",
}

VALID_TRANSACTION_PAYLOAD = {
    "amount": 250000.0,
    "transaction_type": "TRANSFER",
    "hour_of_day": 3,
    "old_balance_origin": 250000.0,
    "new_balance_origin": 0.0,
    "old_balance_dest": 0.0,
    "new_balance_dest": 250000.0,
}



@pytest.mark.anyio
async def test_predict_requires_authentication():
    """Verify unauthenticated requests to /api/predict return 401 Unauthorized."""
    # Ensure no dependency override
    app.dependency_overrides.pop(get_current_user, None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/predict", json=VALID_TRANSACTION_PAYLOAD)
        assert response.status_code == 401


@pytest.mark.anyio
async def test_predict_validation_error():
    """Verify invalid payloads return 422 Unprocessable Entity."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Negative amount violates gt=0
            invalid_payload = VALID_TRANSACTION_PAYLOAD.copy()
            invalid_payload["amount"] = -500.0
            response = await client.post("/api/predict", json=invalid_payload)
            assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_predict_success_and_db_persistence():
    """Verify successful prediction, SHAP explanation, ID format, and MongoDB persistence."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    mock_db = MagicMock()
    mock_collection = AsyncMock()
    mock_db.__getitem__.return_value = mock_collection

    try:
        with patch("app.api.routes_predict.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/api/predict", json=VALID_TRANSACTION_PAYLOAD)

                assert response.status_code == 200
                data = response.json()

                # Verify transaction_id format: "TXN_" + short unique id
                assert data["transaction_id"].startswith("TXN_")
                assert len(data["transaction_id"]) >= 14

                # Verify prediction and risk metrics
                assert data["prediction"] in ["Potential Fraud", "Likely Legitimate"]
                assert 0.0 <= data["risk_score"] <= 1.0
                assert data["risk_level"] in ["Low", "Medium", "High"]
                assert isinstance(data["recommendation"], str)

                # Verify top_features returned from explain_service
                assert isinstance(data["top_features"], list)
                assert len(data["top_features"]) == 5
                for feat in data["top_features"]:
                    assert "feature" in feat
                    assert "shap_value" in feat
                    assert feat["direction"] in ["increases_risk", "decreases_risk"]

                # Verify MongoDB persistence call
                mock_collection.insert_one.assert_awaited_once()
                inserted_doc = mock_collection.insert_one.await_args[0][0]

                assert inserted_doc["transaction_id"] == data["transaction_id"]
                assert inserted_doc["amount"] == 250000.0
                assert inserted_doc["transaction_type"] == "TRANSFER"
                assert inserted_doc["hour_of_day"] == 3
                assert inserted_doc["old_balance_origin"] == 250000.0
                assert inserted_doc["new_balance_origin"] == 0.0
                assert inserted_doc["prediction"] == data["prediction"]
                assert inserted_doc["risk_score"] == data["risk_score"]
                assert inserted_doc["risk_level"] == data["risk_level"]
                assert inserted_doc["analyzed_by"] == SAMPLE_USER["id"]
                assert inserted_doc["user_id"] == SAMPLE_USER["id"]
                assert isinstance(inserted_doc["created_at"], datetime)
                assert data["saved"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_simulate_requires_authentication():
    """Verify unauthenticated requests to /api/simulate return 401 Unauthorized."""
    app.dependency_overrides.pop(get_current_user, None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/simulate", json=VALID_TRANSACTION_PAYLOAD)
        assert response.status_code == 401


@pytest.mark.anyio
async def test_simulate_validation_errors():
    """Verify /api/simulate rejects invalid amount, hour, transaction_type, or negative balances with 422."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Negative balance
            neg_balance = {**VALID_TRANSACTION_PAYLOAD, "old_balance_origin": -10.0}
            res1 = await client.post("/api/simulate", json=neg_balance)
            assert res1.status_code == 422

            # 2. Zero/negative amount
            zero_amount = {**VALID_TRANSACTION_PAYLOAD, "amount": 0.0}
            res2 = await client.post("/api/simulate", json=zero_amount)
            assert res2.status_code == 422

            # 3. Invalid hour_of_day
            bad_hour = {**VALID_TRANSACTION_PAYLOAD, "hour_of_day": 24}
            res3 = await client.post("/api/simulate", json=bad_hour)
            assert res3.status_code == 422

            # 4. Unknown transaction_type
            bad_type = {**VALID_TRANSACTION_PAYLOAD, "transaction_type": "WIRE"}
            res4 = await client.post("/api/simulate", json=bad_type)
            assert res4.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_simulate_returns_score_and_shap_without_db_insert():
    """Verify /api/simulate returns valid score + SHAP features and does NOT insert into transactions collection."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    stored_docs = [{"transaction_id": "TXN_EXISTING_1"}]
    mock_db = MagicMock()
    mock_collection = AsyncMock()

    async def fake_insert_one(doc):
        stored_docs.append(doc)

    async def fake_count_documents(query=None):
        return len(stored_docs)

    mock_collection.insert_one.side_effect = fake_insert_one
    mock_collection.count_documents.side_effect = fake_count_documents
    mock_db.__getitem__.return_value = mock_collection

    try:
        with patch("app.api.routes_predict.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                count_before = await mock_collection.count_documents({})
                assert count_before == 1

                response = await client.post("/api/simulate", json=VALID_TRANSACTION_PAYLOAD)
                assert response.status_code == 200
                data = response.json()

                # Verify simulation flags
                assert data["transaction_id"] is None
                assert data["saved"] is False

                # Verify prediction and risk metrics
                assert data["prediction"] in ["Potential Fraud", "Likely Legitimate"]
                assert 0.0 <= data["risk_score"] <= 1.0
                assert data["risk_level"] in ["Low", "Medium", "High"]
                assert isinstance(data["recommendation"], str)

                # Verify SHAP features
                assert isinstance(data["top_features"], list)
                assert len(data["top_features"]) == 5
                for feat in data["top_features"]:
                    assert "feature" in feat
                    assert "shap_value" in feat
                    assert feat["direction"] in ["increases_risk", "decreases_risk"]

                # Verify NO database insert happened and collection count before == after
                mock_collection.insert_one.assert_not_awaited()
                count_after = await mock_collection.count_documents({})
                assert count_after == count_before
    finally:
        app.dependency_overrides.pop(get_current_user, None)

