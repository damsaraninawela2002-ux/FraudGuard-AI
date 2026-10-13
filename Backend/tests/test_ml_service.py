from unittest.mock import patch
import pytest

from app.schemas.transaction import TransactionInput
from app.services.ml_service import (
    FEATURE_ORDER,
    LABEL_FRAUD,
    LABEL_LEGITIMATE,
    MLService,
    RECOMMENDATION_HIGH,
    RECOMMENDATION_LOW,
    RECOMMENDATION_MEDIUM,
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    THRESHOLD_FRAUD_PREDICTION,
    THRESHOLD_HIGH_RISK,
    THRESHOLD_LOW_RISK,
    get_ml_service,
)


@pytest.fixture
def sample_transaction():
    return TransactionInput(
        amount=250000.0,
        transaction_type="TRANSFER",
        hour_of_day=2,
        old_balance_origin=250000.0,
        new_balance_origin=0.0,
        old_balance_dest=0.0,
        new_balance_dest=250000.0,
    )


@pytest.fixture
def low_risk_transaction():
    return TransactionInput(
        amount=50.0,
        transaction_type="PAYMENT",
        hour_of_day=14,
        old_balance_origin=1500.0,
        new_balance_origin=1450.0,
        old_balance_dest=0.0,
        new_balance_dest=0.0,
    )



def test_ml_service_singleton():
    svc1 = get_ml_service()
    svc2 = get_ml_service()
    assert svc1 is svc2


def test_ml_service_model_prediction(sample_transaction):
    svc = MLService()
    svc.load_artifacts()

    result = svc.predict(sample_transaction)

    assert "risk_score" in result
    assert "prediction" in result
    assert "risk_level" in result
    assert "recommendation" in result
    assert "is_demo" in result

    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["prediction"] in [LABEL_FRAUD, LABEL_LEGITIMATE]
    assert result["risk_level"] in [RISK_LOW, RISK_MEDIUM, RISK_HIGH]

    # Check threshold logic
    if result["risk_score"] >= THRESHOLD_FRAUD_PREDICTION:
        assert result["prediction"] == LABEL_FRAUD
    else:
        assert result["prediction"] == LABEL_LEGITIMATE

    if result["risk_score"] > THRESHOLD_HIGH_RISK:
        assert result["risk_level"] == RISK_HIGH
        assert result["recommendation"] == RECOMMENDATION_HIGH
    elif result["risk_score"] >= THRESHOLD_LOW_RISK:
        assert result["risk_level"] == RISK_MEDIUM
        assert result["recommendation"] == RECOMMENDATION_MEDIUM
    else:
        assert result["risk_level"] == RISK_LOW
        assert result["recommendation"] == RECOMMENDATION_LOW


def test_ml_service_demo_mode_fallback(sample_transaction, low_risk_transaction):
    # Simulate missing model files
    svc = MLService()
    with patch("pathlib.Path.exists", return_value=False):
        svc.load_artifacts()
        assert svc.is_demo is True

    # High-risk demo prediction
    high_res = svc.predict(sample_transaction)
    assert high_res["is_demo"] is True
    assert high_res["risk_score"] > THRESHOLD_FRAUD_PREDICTION
    assert high_res["prediction"] == LABEL_FRAUD
    assert high_res["risk_level"] == RISK_HIGH
    assert high_res["recommendation"] == RECOMMENDATION_HIGH

    # Low-risk demo prediction
    low_res = svc.predict(low_risk_transaction)
    assert low_res["is_demo"] is True
    assert low_res["risk_score"] < THRESHOLD_LOW_RISK
    assert low_res["prediction"] == LABEL_LEGITIMATE
    assert low_res["risk_level"] == RISK_LOW
    assert low_res["recommendation"] == RECOMMENDATION_LOW


def test_feature_order_integrity():
    assert len(FEATURE_ORDER) == 7
    assert FEATURE_ORDER == [
        "amount",
        "hour_of_day",
        "old_balance_origin",
        "new_balance_origin",
        "old_balance_dest",
        "new_balance_dest",
        "transaction_type",
    ]
