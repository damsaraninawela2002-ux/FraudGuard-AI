from datetime import datetime
from bson import ObjectId
import pytest
from pydantic import ValidationError

from app.schemas.user import Token, UserCreate, UserLogin, UserOut
from app.schemas.transaction import (
    FeatureContribution,
    PaginatedTransactions,
    PredictionResult,
    TransactionInput,
    TransactionOut,
)


def test_user_create_validation():
    # Valid
    user = UserCreate(email="analyst@fraudguard.ai", password="securePassword123", full_name="Sarah Connor")
    assert user.email == "analyst@fraudguard.ai"
    assert user.full_name == "Sarah Connor"

    # Password too short (< 8 chars)
    with pytest.raises(ValidationError):
        UserCreate(email="analyst@fraudguard.ai", password="short", full_name="Sarah Connor")

    # Invalid email
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", password="securePassword123", full_name="Sarah Connor")


def test_user_out_serialization():
    oid = ObjectId()
    now = datetime.now()
    user_out = UserOut(_id=oid, email="analyst@fraudguard.ai", full_name="Sarah Connor", created_at=now)

    assert user_out.id == str(oid)
    assert user_out.email == "analyst@fraudguard.ai"
    assert not hasattr(user_out, "password")


def test_token_schema():
    token = Token(access_token="sample.jwt.token")
    assert token.access_token == "sample.jwt.token"
    assert token.token_type == "bearer"


def test_transaction_input_validation():
    # Valid transaction
    tx = TransactionInput(
        amount=150000.0,
        transaction_type="TRANSFER",
        hour_of_day=14,
        old_balance_origin=150000.0,
        new_balance_origin=0.0,
        old_balance_dest=0.0,
        new_balance_dest=150000.0,
    )
    assert tx.amount == 150000.0
    assert tx.transaction_type == "TRANSFER"

    # Derive hour_of_day from step and test lowercase transaction_type normalization
    tx_step = TransactionInput(
        amount=500.0,
        transaction_type="payment",
        step=50,  # 50 % 24 = 2
        old_balance_origin=1000.0,
        new_balance_origin=500.0,
        old_balance_dest=0.0,
        new_balance_dest=0.0,
    )
    assert tx_step.hour_of_day == 2
    assert tx_step.transaction_type == "PAYMENT"

    # Invalid transaction_type (not one of PAYMENT, TRANSFER, CASH_OUT, CASH_IN, DEBIT)
    with pytest.raises(ValidationError):
        TransactionInput(
            amount=500.0,
            transaction_type="INVALID_TYPE",
            hour_of_day=10,
            old_balance_origin=100.0,
            new_balance_origin=100.0,
            old_balance_dest=0.0,
            new_balance_dest=0.0,
        )

    # Amount <= 0 should fail
    with pytest.raises(ValidationError):
        TransactionInput(
            amount=0.0,
            transaction_type="PAYMENT",
            hour_of_day=10,
            old_balance_origin=100.0,
            new_balance_origin=100.0,
            old_balance_dest=0.0,
            new_balance_dest=0.0,
        )

    # Invalid hour_of_day (< 0 or > 23)
    with pytest.raises(ValidationError):
        TransactionInput(
            amount=10.0,
            transaction_type="PAYMENT",
            hour_of_day=25,
            old_balance_origin=100.0,
            new_balance_origin=100.0,
            old_balance_dest=0.0,
            new_balance_dest=0.0,
        )



def test_prediction_result_and_features():
    feat1 = FeatureContribution(
        feature="old_balance_origin",
        shap_value=2.4512,
        direction="increases_risk",
    )
    assert feat1.direction == "increases_risk"

    pred = PredictionResult(
        transaction_id="tx_12345",
        prediction="Potential Fraud",
        risk_score=0.92,
        risk_level="High",
        top_features=[feat1],
        recommendation="Flag for manual inspection.",
        created_at=datetime.now(),
    )
    assert pred.risk_score == 0.92
    assert pred.risk_level == "High"
    assert len(pred.top_features) == 1

    # Invalid risk score (> 1.0)
    with pytest.raises(ValidationError):
        PredictionResult(
            transaction_id="tx_12345",
            prediction="Potential Fraud",
            risk_score=1.5,
            risk_level="High",
            top_features=[],
            recommendation="Test",
        )


def test_transaction_out_and_paginated():
    oid = ObjectId()
    now = datetime.now()

    tx_out = TransactionOut(
        _id=oid,
        transaction_id="tx_9999",
        amount=10000.0,
        transaction_type="CASH_OUT",
        hour_of_day=3,
        old_balance_origin=10000.0,
        new_balance_origin=0.0,
        old_balance_dest=50000.0,
        new_balance_dest=60000.0,
        prediction="Potential Fraud",

        risk_score=0.87,
        risk_level="High",
        top_features=[],
        recommendation="Account balance drained.",
        created_at=now,
    )
    assert tx_out.id == str(oid)
    assert tx_out.transaction_type == "CASH_OUT"

    paginated = PaginatedTransactions(
        items=[tx_out],
        total=1,
        page=1,
        page_size=10,
    )
    assert paginated.total == 1
    assert len(paginated.items) == 1
    assert paginated.page == 1
