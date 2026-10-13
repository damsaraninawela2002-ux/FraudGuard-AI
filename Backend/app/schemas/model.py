"""Pydantic schemas for Model evaluation metrics and performance monitoring.

FraudGuard AI – Explainable Fraud Detection System
"""

from typing import Optional
from pydantic import BaseModel, Field


class ConfusionMatrix(BaseModel):
    """Confusion matrix counts for the evaluated classification model."""

    tn: int = Field(..., ge=0, description="True Negatives (legitimate correctly identified)", examples=[5967])
    fp: int = Field(..., ge=0, description="False Positives (legitimate flagged as fraud)", examples=[3])
    fn: int = Field(..., ge=0, description="False Negatives (fraud missed by model)", examples=[8])
    tp: int = Field(..., ge=0, description="True Positives (fraud correctly detected)", examples=[22])


class ModelMetricsResponse(BaseModel):
    """Performance evaluation metrics for the production model on the held-out test set."""

    model_name: Optional[str] = Field(default=None, description="Architecture name of the trained model", examples=["XGBClassifier"])
    precision: float = Field(..., ge=0.0, le=1.0, description="Precision score on the fraud class", examples=[0.8800])
    recall: float = Field(..., ge=0.0, le=1.0, description="Recall / sensitivity on the fraud class", examples=[0.7333])
    f1_score: float = Field(..., ge=0.0, le=1.0, description="F1-score harmonic mean", examples=[0.8000])
    pr_auc: float = Field(..., ge=0.0, le=1.0, description="Precision-Recall Area Under the Curve", examples=[0.8246])
    roc_auc: float = Field(..., ge=0.0, le=1.0, description="Receiver Operating Characteristic Area Under the Curve", examples=[0.9963])
    confusion_matrix: ConfusionMatrix = Field(..., description="Binary confusion matrix breakdown")
    threshold: Optional[float] = Field(default=0.5, description="Decision threshold applied during test evaluation", examples=[0.5])
    trained_at: Optional[str] = Field(default=None, description="ISO timestamp when the model was trained", examples=["2026-10-12T21:49:47.515767"])
