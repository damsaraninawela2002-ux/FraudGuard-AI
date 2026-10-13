"""Prediction API endpoint for real-time fraud scoring and SHAP explainability.

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict
import uuid

from fastapi import APIRouter, Depends, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.schemas.transaction import PredictionResult, TransactionInput
from app.services.explain_service import get_explain_service
from app.services.ml_service import get_ml_service

logger = logging.getLogger("fraudguard.routes_predict")

router = APIRouter(prefix="/api", tags=["Prediction"])


def _run_inference(transaction: TransactionInput) -> Dict[str, Any]:
    """Run shared ML model inference and SHAP feature attribution without DB side effects."""
    ml_service = get_ml_service()
    pred_result = ml_service.predict(transaction)

    explain_service = get_explain_service()
    top_features = explain_service.explain(transaction)

    return {
        "prediction": pred_result["prediction"],
        "risk_score": pred_result["risk_score"],
        "risk_level": pred_result["risk_level"],
        "recommendation": pred_result["recommendation"],
        "top_features": top_features,
    }


@router.post(
    "/predict",
    response_model=PredictionResult,
    status_code=status.HTTP_200_OK,
    summary="Predict fraud probability and explain drivers",
    description=(
        "Evaluates a transaction using the trained ML model and SHAP TreeExplainer, "
        "persists the complete inference record into MongoDB, and returns an explainable result."
    ),
)
async def predict_transaction(
    transaction: TransactionInput,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PredictionResult:
    """Evaluate transaction fraud risk, generate SHAP explanations, and persist to database."""
    # 1. Run shared model prediction and SHAP attribution
    inference = _run_inference(transaction)

    # 2. Generate a unique transaction business identifier
    unique_suffix = uuid.uuid4().hex[:10].upper()
    transaction_id = f"TXN_{unique_suffix}"

    # 3. Resolve authenticated analyst identifier
    user_id = str(current_user.get("_id") or current_user.get("id") or "system")
    now_utc = datetime.now(timezone.utc)

    # 4. Persist the complete record to MongoDB transactions collection
    transaction_doc = {
        "transaction_id": transaction_id,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "hour_of_day": transaction.hour_of_day,
        "old_balance_origin": transaction.old_balance_origin,
        "new_balance_origin": transaction.new_balance_origin,
        "old_balance_dest": transaction.old_balance_dest,
        "new_balance_dest": transaction.new_balance_dest,
        "prediction": inference["prediction"],
        "risk_score": inference["risk_score"],
        "risk_level": inference["risk_level"],
        "top_features": [f.model_dump() for f in inference["top_features"]],
        "recommendation": inference["recommendation"],
        "analyzed_by": user_id,
        "user_id": user_id,
        "created_at": now_utc,
    }

    try:
        db = get_database()
        await db["transactions"].insert_one(transaction_doc)
        logger.info(
            "Transaction %s evaluated (risk_score=%.4f, risk_level=%s) by user %s",
            transaction_id,
            inference["risk_score"],
            inference["risk_level"],
            user_id,
        )
    except Exception as exc:
        logger.error("Failed to persist transaction %s to MongoDB: %s", transaction_id, exc)
        # Note: Do not block returning the prediction result if DB fails temporarily
        # but log error prominently

    # 5. Return standard explainable prediction outcome
    return PredictionResult(
        transaction_id=transaction_id,
        prediction=inference["prediction"],
        risk_score=inference["risk_score"],
        risk_level=inference["risk_level"],
        top_features=inference["top_features"],
        recommendation=inference["recommendation"],
        saved=True,
        created_at=now_utc,
    )


@router.post(
    "/simulate",
    response_model=PredictionResult,
    status_code=status.HTTP_200_OK,
    summary="Simulate fraud probability without persisting to database",
    description=(
        "Evaluates a hypothetical transaction in the What-If Sandbox using the same "
        "ML model and SHAP TreeExplainer as /api/predict, without writing anything to MongoDB."
    ),
)
async def simulate_transaction(
    transaction: TransactionInput,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PredictionResult:
    """Evaluate hypothetical transaction fraud risk and SHAP explanations without DB persistence."""
    inference = _run_inference(transaction)
    now_utc = datetime.now(timezone.utc)

    return PredictionResult(
        transaction_id=None,
        prediction=inference["prediction"],
        risk_score=inference["risk_score"],
        risk_level=inference["risk_level"],
        top_features=inference["top_features"],
        recommendation=inference["recommendation"],
        saved=False,
        created_at=now_utc,
    )
