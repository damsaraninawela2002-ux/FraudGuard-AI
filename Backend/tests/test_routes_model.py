"""Unit tests for the Model metrics route (/api/model/metrics).

FraudGuard AI – Explainable Fraud Detection System
"""

import json
from pathlib import Path
from unittest.mock import patch
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

SAMPLE_METRICS = {
    "model_name": "XGBClassifier",
    "precision": 0.88,
    "recall": 0.7333,
    "f1_score": 0.8,
    "pr_auc": 0.8246,
    "roc_auc": 0.9963,
    "confusion_matrix": {
        "tn": 5967,
        "fp": 3,
        "fn": 8,
        "tp": 22,
    },
    "threshold": 0.5,
    "trained_at": "2026-10-12T21:49:47.515767",
}


@pytest.mark.anyio
async def test_model_metrics_requires_authentication():
    """Verify unauthenticated requests to /api/model/metrics return 401 Unauthorized."""
    app.dependency_overrides.pop(get_current_user, None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/model/metrics")
        assert response.status_code == 401


@pytest.mark.anyio
async def test_model_metrics_success(tmp_path: Path):
    """Verify /api/model/metrics returns metrics and confusion matrix values when metrics.json exists."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    # Create temporary metrics.json file
    temp_metrics_file = tmp_path / "metrics.json"
    temp_metrics_file.write_text(json.dumps(SAMPLE_METRICS), encoding="utf-8")

    try:
        with patch("app.api.routes_model.resolve_metrics_file_path", return_value=temp_metrics_file):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/model/metrics")
                assert response.status_code == 200
                data = response.json()

                # Verify all requested metrics are returned
                assert data["model_name"] == "XGBClassifier"
                assert data["precision"] == 0.88
                assert data["recall"] == 0.7333
                assert data["f1_score"] == 0.8
                assert data["pr_auc"] == 0.8246
                assert data["roc_auc"] == 0.9963

                # Verify confusion matrix
                cm = data["confusion_matrix"]
                assert cm["tn"] == 5967
                assert cm["fp"] == 3
                assert cm["fn"] == 8
                assert cm["tp"] == 22

                assert data["threshold"] == 0.5
                assert data["trained_at"] == "2026-10-12T21:49:47.515767"

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_model_metrics_file_not_found():
    """Verify /api/model/metrics returns 404 with exact message when metrics file does not exist."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    try:
        with patch("app.api.routes_model.resolve_metrics_file_path", return_value=None):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get("/api/model/metrics")
                assert response.status_code == 404
                assert response.json()["detail"] == "Model metrics not available yet. Train the model first."

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_model_metrics_real_file_exists():
    """Verify /api/model/metrics successfully reads the actual ml/reports/metrics.json file on disk."""
    app.dependency_overrides[get_current_user] = lambda: SAMPLE_USER

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/model/metrics")
            # If the ml/reports/metrics.json exists in this repository, it should return 200
            assert response.status_code == 200
            data = response.json()
            assert "precision" in data
            assert "recall" in data
            assert "f1_score" in data
            assert "pr_auc" in data
            assert "roc_auc" in data
            assert "confusion_matrix" in data

    finally:
        app.dependency_overrides.pop(get_current_user, None)
