"""Unit tests for the Transactions routes (/api/transactions, /api/stats, /api/report/export).

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
import pytest

from app.api.routes_transactions import build_transaction_filter
from app.core.security import get_current_admin, get_current_user
from app.main import app

SAMPLE_ANALYST = {
    "_id": "670a5b281234567890abcdef",
    "id": "670a5b281234567890abcdef",
    "email": "analyst@fraudguard.ai",
    "full_name": "Compliance Analyst",
    "role": "analyst",
}

SAMPLE_ADMIN = {
    "_id": "670a5b289999999999abcdef",
    "id": "670a5b289999999999abcdef",
    "email": "admin@fraudguard.ai",
    "full_name": "Security Admin",
    "role": "admin",
}

SAMPLE_TX_DOC = {
    "_id": ObjectId("670a5b281234567890abcdef"),
    "transaction_id": "TXN_ABC1234567",
    "amount": 185000.0,
    "transaction_type": "TRANSFER",
    "hour_of_day": 2,
    "old_balance_origin": 185000.0,
    "new_balance_origin": 0.0,
    "old_balance_dest": 0.0,
    "new_balance_dest": 185000.0,
    "prediction": "Potential Fraud",

    "risk_score": 0.9421,
    "risk_level": "High",
    "top_features": [
        {"feature": "old_balance_origin", "shap_value": 7.8210, "direction": "increases_risk"},
        {"feature": "new_balance_origin", "shap_value": 1.2540, "direction": "increases_risk"},
    ],
    "recommendation": "Manual review required",
    "analyzed_by": "670a5b281234567890abcdef",
    "user_id": "670a5b281234567890abcdef",
    "created_at": datetime.now(timezone.utc),
}


@pytest.mark.anyio
async def test_transactions_requires_auth():
    """Verify endpoints require authentication."""
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_admin, None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET /api/transactions
        r1 = await client.get("/api/transactions")
        assert r1.status_code == 401

        # GET /api/stats
        r2 = await client.get("/api/stats")
        assert r2.status_code == 401

        # GET /api/report/export
        r3 = await client.get("/api/report/export")
        assert r3.status_code == 401

        # DELETE /api/transactions/TXN_ABC
        r4 = await client.delete("/api/transactions/TXN_ABC")
        assert r4.status_code == 401


@pytest.mark.anyio
async def test_list_transactions_pagination_and_filter():
    """Verify paginated listing with filters and descending sort."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_ANALYST

    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    # Setup find cursor mock
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[SAMPLE_TX_DOC])
    mock_collection.find.return_value = mock_cursor
    mock_collection.count_documents = AsyncMock(return_value=1)

    try:
        with patch("app.api.routes_transactions.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get(
                    "/api/transactions",
                    params={
                        "page": 1,
                        "page_size": 10,
                        "risk_level": "High",
                        "prediction": "Potential Fraud",
                        "search": "TXN_ABC",
                    },
                )
                assert response.status_code == 200
                data = response.json()

                assert data["total"] == 1
                assert data["page"] == 1
                assert data["page_size"] == 10
                assert len(data["items"]) == 1

                item = data["items"][0]
                assert item["transaction_id"] == "TXN_ABC1234567"
                assert item["_id"] == str(SAMPLE_TX_DOC["_id"])
                assert isinstance(item["_id"], str)
                assert item["risk_level"] == "High"
                assert item["prediction"] == "Potential Fraud"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_get_single_transaction_found_and_not_found():
    """Verify retrieving a transaction by ID and returning 404 when absent."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_ANALYST

    mock_db = MagicMock()
    mock_collection = AsyncMock()
    mock_db.__getitem__.return_value = mock_collection

    try:
        with patch("app.api.routes_transactions.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # 1. Success case
                mock_collection.find_one.return_value = SAMPLE_TX_DOC.copy()
                r_ok = await client.get("/api/transactions/TXN_ABC1234567")
                assert r_ok.status_code == 200
                data = r_ok.json()
                assert data["transaction_id"] == "TXN_ABC1234567"
                assert data["_id"] == str(SAMPLE_TX_DOC["_id"])
                assert isinstance(data["_id"], str)

                # 2. 404 case
                mock_collection.find_one.return_value = None
                r_missing = await client.get("/api/transactions/TXN_NONEXISTENT")
                assert r_missing.status_code == 404
                assert "not found" in r_missing.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_get_stats_aggregation():
    """Verify GET /api/stats metrics calculations and daily fraud grouping."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_ANALYST

    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    mock_collection.count_documents = AsyncMock(side_effect=[150, 25])

    # Aggregations for risk counts and daily timeline
    risk_cursor_mock = MagicMock()
    risk_cursor_mock.to_list = AsyncMock(
        return_value=[
            {"_id": "Low", "count": 100},
            {"_id": "Medium", "count": 25},
            {"_id": "High", "count": 25},
        ]
    )
    daily_cursor_mock = MagicMock()
    daily_cursor_mock.to_list = AsyncMock(
        return_value=[
            {"date": "2026-10-10", "count": 3},
            {"date": "2026-10-11", "count": 7},
        ]
    )

    mock_collection.aggregate.side_effect = [risk_cursor_mock, daily_cursor_mock]

    try:
        with patch("app.api.routes_transactions.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/stats")
                assert response.status_code == 200
                data = response.json()

                assert data["total_analyzed"] == 150
                assert data["potential_fraud_count"] == 25
                assert data["counts_per_risk_level"] == {"Low": 100, "Medium": 25, "High": 25}
                assert len(data["fraud_per_day"]) == 2
                assert data["fraud_per_day"][0]["date"] == "2026-10-10"
                assert data["fraud_per_day"][0]["count"] == 3
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_report_export_csv():
    """Verify GET /api/report/export returns StreamingResponse CSV download."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_ANALYST

    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    # Async cursor iteration for CSV generation
    class AsyncDocCursor:
        def __init__(self, docs):
            self.docs = docs

        def sort(self, *args, **kwargs):
            return self

        def __aiter__(self):
            self.iter = iter(self.docs)
            return self

        async def __anext__(self):
            try:
                return next(self.iter)
            except StopIteration:
                raise StopAsyncIteration

    mock_collection.find.return_value = AsyncDocCursor([SAMPLE_TX_DOC])

    try:
        with patch("app.api.routes_transactions.get_database", return_value=mock_db):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/report/export")
                assert response.status_code == 200
                assert "text/csv" in response.headers["content-type"]
                assert 'filename="transactions_report.csv"' in response.headers["content-disposition"]

                csv_text = response.text
                lines = csv_text.strip().split("\r\n") if "\r\n" in csv_text else csv_text.strip().split("\n")
                assert len(lines) >= 2
                header = lines[0]
                assert "transaction_id" in header
                assert "risk_score" in header
                assert "TXN_ABC1234567" in lines[1]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_delete_transaction_role_restrictions():
    """Verify DELETE /api/transactions/{transaction_id} is strictly admin-only."""
    mock_db = MagicMock()
    mock_collection = AsyncMock()
    mock_db.__getitem__.return_value = mock_collection

    try:
        with patch("app.api.routes_transactions.get_database", return_value=mock_db):
            # 1. Analyst user gets 403 Forbidden
            app.dependency_overrides[get_current_user] = lambda: SAMPLE_ANALYST
            app.dependency_overrides[get_current_admin] = lambda: (_ for _ in ()).throw(
                pytest.importorskip("fastapi").HTTPException(status_code=403, detail="Admin privileges required")
            )

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                r_forbidden = await client.delete("/api/transactions/TXN_ABC1234567")
                assert r_forbidden.status_code == 403

            # 2. Admin user deletes successfully
            app.dependency_overrides[get_current_user] = lambda: SAMPLE_ADMIN
            app.dependency_overrides[get_current_admin] = lambda: SAMPLE_ADMIN

            mock_collection.delete_one.return_value = MagicMock(deleted_count=1)
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                r_ok = await client.delete("/api/transactions/TXN_ABC1234567")
                assert r_ok.status_code == 200
                assert r_ok.json()["message"] == "Transaction deleted successfully"

            # 3. Admin user gets 404 if transaction is missing
            mock_collection.delete_one.return_value = MagicMock(deleted_count=0)
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                r_missing = await client.delete("/api/transactions/TXN_NOT_FOUND")
                assert r_missing.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_current_admin, None)


def test_build_transaction_filter_escapes_special_regex():
    """Verify search filter safely escapes regex metacharacters to avoid injection and ReDoS."""
    malicious_input = "TXN_.*[0-9]+(test)?"
    query = build_transaction_filter(search=malicious_input)
    assert "transaction_id" in query
    # Metacharacters must be escaped
    assert r"\." in query["transaction_id"]["$regex"]
    assert r"\*" in query["transaction_id"]["$regex"]
    assert r"\[" in query["transaction_id"]["$regex"]
    assert query["transaction_id"]["$options"] == "i"

