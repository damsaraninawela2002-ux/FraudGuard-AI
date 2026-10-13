"""Pydantic schemas for Transaction evaluation, predictions, and persistence.

FraudGuard AI – Explainable Fraud Detection System

IMPORTANT DATASET COMPATIBILITY NOTICE:
----------------------------------------
The feature fields declared in `TransactionFeatures` / `TransactionInput` MUST
EXACTLY MATCH the dataset columns and preprocessing transformer configured in the
ML training pipeline (`ml/src/config.py`).

If features in the dataset are modified, added, or renamed (e.g., adding merchant
category codes or IP risk scores), update `TransactionFeatures` in this ONE place.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================================
# CENTRALIZED FEATURE DEFINITIONS
# Modify this class in ONE place whenever changing ML dataset feature schema
# ============================================================================
class TransactionFeatures(BaseModel):
    """Core transaction features utilized by the fraud detection ML model.

    NOTE: These fields correspond directly to the feature names expected by the
    trained model and preprocessor (StandardScaler for numerics, OneHotEncoder for
    categoricals). Modify here in ONE place if features change.
    """

    amount: float = Field(
        ...,
        gt=0.0,
        description="Transaction monetary amount (must be positive, > 0)",
        examples=[185000.00],
    )
    transaction_type: Literal["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"] = Field(
        ...,
        description="Transaction category (one of PAYMENT, TRANSFER, CASH_OUT, CASH_IN, DEBIT)",
        examples=["TRANSFER"],
    )
    hour_of_day: int = Field(
        ...,
        ge=0,
        le=23,
        description="Hour of day (0-23) derived from transaction timestamp (step % 24)",
        examples=[14],
    )
    old_balance_origin: float = Field(
        ...,
        ge=0.0,
        description="Initial balance of origin customer account before transaction (must be >= 0)",
        examples=[185000.00],
    )
    new_balance_origin: float = Field(
        ...,
        ge=0.0,
        description="New balance of origin customer account after transaction (must be >= 0)",
        examples=[0.00],
    )
    old_balance_dest: float = Field(
        ...,
        ge=0.0,
        description="Initial balance of recipient destination account before transaction (must be >= 0)",
        examples=[0.00],
    )
    new_balance_dest: float = Field(
        ...,
        ge=0.0,
        description="New balance of recipient destination account after transaction (must be >= 0)",
        examples=[185000.00],
    )

    model_config = ConfigDict(extra="ignore")

    @field_validator("transaction_type", mode="before")
    @classmethod
    def normalize_transaction_type(cls, v: Any) -> Any:
        """Normalize transaction type string to uppercase."""
        if isinstance(v, str):
            return v.strip().upper()
        return v



class TransactionInput(TransactionFeatures):
    """Input payload sent to the fraud detection prediction endpoint."""

    @model_validator(mode="before")
    @classmethod
    def populate_hour_from_step(cls, data: Any) -> Any:
        """Helper to derive hour_of_day from raw simulation step if passed in payload."""
        if isinstance(data, dict):
            if "hour_of_day" not in data and "step" in data:
                data["hour_of_day"] = int(data["step"]) % 24
        return data


class FeatureContribution(BaseModel):
    """Individual feature SHAP attribution explaining model decision drivers."""

    feature: str = Field(
        ...,
        description="Name of the evaluated feature",
        examples=["old_balance_origin"],
    )
    shap_value: float = Field(
        ...,
        description="SHAP attribution value (positive increases fraud probability, negative decreases)",
        examples=[1.4523],
    )
    direction: Literal["increases_risk", "decreases_risk"] = Field(
        ...,
        description="Effect of feature on fraud risk: 'increases_risk' or 'decreases_risk'",
        examples=["increases_risk"],
    )


class PredictionResult(BaseModel):
    """Explainable model prediction outcome for an evaluated or simulated transaction."""

    transaction_id: Optional[str] = Field(
        default=None,
        description="Unique identifier assigned to the analyzed transaction (None for What-If simulations)",
        examples=["TXN_6702A4BF8F"],
    )
    prediction: Literal["Potential Fraud", "Likely Legitimate"] = Field(
        ...,
        description="Binary classification outcome: 'Potential Fraud' or 'Likely Legitimate'",
        examples=["Potential Fraud"],
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Calibrated probability score between 0.0 and 1.0",
        examples=[0.9421],
    )
    risk_level: Literal["Low", "Medium", "High"] = Field(
        ...,
        description="Risk categorization tier: 'Low', 'Medium', or 'High'",
        examples=["High"],
    )
    top_features: List[FeatureContribution] = Field(
        default_factory=list,
        description="Top 5 feature drivers ranked by absolute SHAP attribution",
    )
    recommendation: str = Field(
        ...,
        description="Actionable operational recommendation for fraud analysts",
        examples=["Transaction flagged: origin account completely depleted. Manual verification recommended."],
    )
    saved: bool = Field(
        default=True,
        description="True when persisted to MongoDB (/api/predict), False for What-If sandbox (/api/simulate)",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when prediction was evaluated",
    )


class TransactionOut(TransactionFeatures):
    """Full historical transaction record retrieved from the database."""

    id: str = Field(
        ...,
        alias="_id",
        description="Unique database identifier (MongoDB ObjectId)",
    )
    transaction_id: str = Field(
        ...,
        description="Unique business identifier for the transaction",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="ID of the user/analyst who submitted or owns the record",
    )
    analyzed_by: Optional[str] = Field(
        default=None,
        description="ID of the user/analyst who analyzed the transaction",
    )
    prediction: Literal["Potential Fraud", "Likely Legitimate"] = Field(
        ...,
        description="Classification decision",
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Predicted fraud probability (0 to 1)",
    )
    risk_level: Literal["Low", "Medium", "High"] = Field(
        ...,
        description="Risk severity tier",
    )
    top_features: List[FeatureContribution] = Field(
        default_factory=list,
        description="Explainability SHAP features list",
    )
    recommendation: str = Field(
        ...,
        description="Recommended analyst action",
    )
    created_at: datetime = Field(
        ...,
        description="Transaction evaluation and persistence timestamp",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("id", mode="before")
    @classmethod
    def convert_id(cls, v: Any) -> str:
        """Convert MongoDB ObjectId or other ID representation to string."""
        return str(v)


class PaginatedTransactions(BaseModel):
    """Paginated collection of transaction history records."""

    items: List[TransactionOut] = Field(
        default_factory=list,
        description="List of transaction records for the current page",
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of matching records in the database",
    )
    page: int = Field(
        ...,
        ge=1,
        description="Current page index (1-based)",
    )
    page_size: int = Field(
        ...,
        ge=1,
        description="Number of records returned per page",
    )


class DailyFraudStat(BaseModel):
    """Fraud transaction count for a single day."""

    date: str = Field(..., description="Date formatted as YYYY-MM-DD", examples=["2026-10-12"])
    count: int = Field(..., ge=0, description="Number of fraudulent transactions detected", examples=[5])


class TransactionStats(BaseModel):
    """Aggregate statistics for evaluated transactions."""

    total_analyzed: int = Field(..., ge=0, description="Total number of evaluated transactions")
    potential_fraud_count: int = Field(..., ge=0, description="Total transactions classified as Potential Fraud")
    counts_per_risk_level: Dict[str, int] = Field(
        default_factory=dict,
        description="Breakdown of transaction counts per risk level (Low, Medium, High)",
    )
    risk_level_counts: Dict[str, int] = Field(
        default_factory=dict,
        description="Alias breakdown of transaction counts per risk level",
    )
    fraud_per_day: List[DailyFraudStat] = Field(
        default_factory=list,
        description="Daily fraud counts over the last 30 days",
    )

