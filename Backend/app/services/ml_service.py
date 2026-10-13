"""Machine Learning Inference Service for Fraud Detection.

FraudGuard AI – Explainable Fraud Detection System

IMPORTANT DISCLAIMER:
---------------------
The risk score, classification prediction, and risk level produced by this
service represent a statistical risk estimate based on learned historical transaction
patterns. This output serves as decision-support telemetry for compliance teams and
fraud analysts and is NOT an absolute confirmation or legal determination of fraud.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.schemas.transaction import TransactionInput

logger = logging.getLogger("fraudguard.ml_service")

# ============================================================================
# RISK LEVEL CONSTANTS & CLASSIFICATION THRESHOLDS
# Centralized in one place for maintainability and consistency.
# ============================================================================
THRESHOLD_LOW_RISK: float = 0.30         # Scores strictly < 0.30 are categorized as Low risk
THRESHOLD_HIGH_RISK: float = 0.70        # Scores strictly > 0.70 are categorized as High risk
THRESHOLD_FRAUD_PREDICTION: float = 0.50 # Scores >= 0.50 are predicted as "Potential Fraud"

LABEL_FRAUD: str = "Potential Fraud"
LABEL_LEGITIMATE: str = "Likely Legitimate"

RISK_LOW: str = "Low"
RISK_MEDIUM: str = "Medium"
RISK_HIGH: str = "High"

RECOMMENDATION_LOW: str = "No action required"
RECOMMENDATION_MEDIUM: str = "Monitor this transaction"
RECOMMENDATION_HIGH: str = "Manual review required"

# Exact column sequence expected by the preprocessing pipeline and trained model
FEATURE_ORDER = [
    "amount",
    "hour_of_day",
    "old_balance_origin",
    "new_balance_origin",
    "old_balance_dest",
    "new_balance_dest",
    "transaction_type",
]


class MLService:
    """Singleton service for loading model artifacts and executing fraud scoring.

    Attributes
    ----------
    model : Any
        Trained classifier instance (e.g. XGBClassifier).
    preprocessor : Any
        Fitted scikit-learn ColumnTransformer instance.
    is_demo : bool
        Flag indicating if the service is running in fallback heuristic demo mode.
    """

    def __init__(self) -> None:
        self.model: Optional[Any] = None
        self.preprocessor: Optional[Any] = None
        self.is_demo: bool = True
        self._initialized: bool = False

    def load_artifacts(self) -> None:
        """Load model and preprocessor artifacts with joblib from disk once at startup.

        If the model or preprocessor files do not exist, logs a warning and enters
        deterministic demo mode.
        """
        settings = get_settings()
        backend_dir = Path(__file__).resolve().parent.parent.parent
        project_root = backend_dir.parent

        model_rel = settings.MODEL_PATH.replace("\\", "/")
        prep_rel = settings.PREPROCESSOR_PATH.replace("\\", "/")

        model_candidates = [
            Path(model_rel),
            backend_dir / model_rel,
            project_root / "ml" / model_rel,
            project_root / model_rel,
            project_root / "ml" / "models" / "fraud_model.joblib",
            backend_dir / "models" / "fraud_model.joblib",
        ]

        prep_candidates = [
            Path(prep_rel),
            backend_dir / prep_rel,
            project_root / "ml" / prep_rel,
            project_root / prep_rel,
            project_root / "ml" / "models" / "preprocessor.joblib",
            backend_dir / "models" / "preprocessor.joblib",
        ]

        resolved_model_path = next((p for p in model_candidates if p.exists() and p.is_file()), None)
        resolved_prep_path = next((p for p in prep_candidates if p.exists() and p.is_file()), None)

        if resolved_model_path and resolved_prep_path:
            try:
                logger.info("Loading preprocessor from %s...", resolved_prep_path)
                self.preprocessor = joblib.load(resolved_prep_path)

                logger.info("Loading model from %s...", resolved_model_path)
                self.model = joblib.load(resolved_model_path)

                self.is_demo = False
                self._initialized = True
                logger.info(
                    "MLService successfully loaded production model (%s).",
                    type(self.model).__name__,
                )
                return
            except Exception as exc:
                logger.error("Failed to load model artifacts: %s. Reverting to demo mode.", exc)

        # Fallback to demo mode if files do not exist or failed loading
        self.is_demo = True
        self._initialized = True
        logger.warning(
            "Model or preprocessor artifacts not found at configured paths. "
            "MLService is running in DEMO MODE with heuristic scoring."
        )

    def predict(self, transaction: TransactionInput) -> Dict[str, Any]:
        """Generate a fraud risk prediction for a transaction.

        Parameters
        ----------
        transaction : TransactionInput
            Validated transaction payload.

        Returns
        -------
        dict
            Dictionary containing `risk_score`, `prediction`, `risk_level`,
            `recommendation`, and `is_demo`.

        Note
        ----
        The output is a statistical risk estimate, not an empirical confirmation of fraud.
        """
        if not self._initialized:
            self.load_artifacts()

        if self.is_demo or self.model is None or self.preprocessor is None:
            risk_score = self._compute_demo_risk_score(transaction)
        else:
            risk_score = self._compute_model_risk_score(transaction)

        # Determine binary prediction label
        prediction = (
            LABEL_FRAUD if risk_score >= THRESHOLD_FRAUD_PREDICTION else LABEL_LEGITIMATE
        )

        # Categorize risk level
        if risk_score > THRESHOLD_HIGH_RISK:
            risk_level = RISK_HIGH
        elif risk_score >= THRESHOLD_LOW_RISK:
            risk_level = RISK_MEDIUM
        else:
            risk_level = RISK_LOW

        recommendation = self._get_recommendation(risk_level)

        return {
            "risk_score": risk_score,
            "prediction": prediction,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "is_demo": self.is_demo,
        }

    def _compute_model_risk_score(self, transaction: TransactionInput) -> float:
        """Execute real model pipeline inference using the exact feature sequence."""
        # Convert input to DataFrame with the exact feature order used during training
        row = {col: getattr(transaction, col) for col in FEATURE_ORDER}
        df = pd.DataFrame([row])

        X_transformed = self.preprocessor.transform(df)
        proba = float(self.model.predict_proba(X_transformed)[0, 1])
        return round(proba, 4)

    def _compute_demo_risk_score(self, transaction: TransactionInput) -> float:
        """Deterministic heuristic scoring when running in demo mode without model files.

        Heuristic rules:
        - Transfers and Cash-outs carry higher inherent risk.
        - High amounts (>50k, >200k) increase risk.
        - Night hours (0-5, 23) indicate elevated risk.
        - Draining the origin account (new_balance_origin == 0) sharply increases risk.
        """
        score = 0.05

        # Transaction type risk
        if transaction.transaction_type in ("TRANSFER", "CASH_OUT"):
            score += 0.25
        elif transaction.transaction_type in ("PAYMENT", "CASH_IN", "DEBIT"):
            score -= 0.03

        # Transaction amount risk
        if transaction.amount >= 200_000:
            score += 0.30
        elif transaction.amount >= 50_000:
            score += 0.15

        # Night hour risk (00:00 to 05:00 and 23:00)
        if transaction.hour_of_day in (0, 1, 2, 3, 4, 5, 23):
            score += 0.20

        # Origin account emptied
        if transaction.new_balance_origin == 0.0 and transaction.old_balance_origin > 0.0:
            score += 0.25

        # Destination balance anomaly
        if transaction.old_balance_dest == 0.0 and transaction.new_balance_dest == 0.0:
            score += 0.10

        return round(float(np.clip(score, 0.01, 0.99)), 4)

    @staticmethod
    def _get_recommendation(risk_level: str) -> str:
        """Map risk level to actionable human-readable operational recommendation."""
        if risk_level == RISK_HIGH:
            return RECOMMENDATION_HIGH
        elif risk_level == RISK_MEDIUM:
            return RECOMMENDATION_MEDIUM
        else:
            return RECOMMENDATION_LOW


# Global singleton instance
_ml_service_instance: Optional[MLService] = None


def get_ml_service() -> MLService:
    """Return the global MLService singleton instance."""
    global _ml_service_instance
    if _ml_service_instance is None:
        _ml_service_instance = MLService()
    return _ml_service_instance
