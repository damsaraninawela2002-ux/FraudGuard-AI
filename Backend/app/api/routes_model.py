"""Model inspection and evaluation metrics API endpoints.

FraudGuard AI – Explainable Fraud Detection System
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import get_current_user
from app.schemas.model import ModelMetricsResponse

logger = logging.getLogger("fraudguard.routes_model")

router = APIRouter(prefix="/api/model", tags=["Model"])


def resolve_metrics_file_path() -> Optional[Path]:
    """Resolve the location of the model metrics.json file from settings or standard paths."""
    settings = get_settings()
    backend_dir = Path(__file__).resolve().parent.parent.parent
    project_root = backend_dir.parent

    metrics_rel = settings.METRICS_PATH.replace("\\", "/")

    candidates = [
        Path(metrics_rel),
        backend_dir / metrics_rel,
        project_root / metrics_rel,
        project_root / "ml" / "reports" / "metrics.json",
        backend_dir / "reports" / "metrics.json",
    ]

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate

    return None


@router.get(
    "/metrics",
    response_model=ModelMetricsResponse,
    summary="Get trained model evaluation metrics",
    description=(
        "Retrieves offline test evaluation metrics (precision, recall, F1, PR-AUC, ROC-AUC, "
        "and confusion matrix) generated during model evaluation."
    ),
)
async def get_model_metrics(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ModelMetricsResponse:
    """Read and return model evaluation metrics from metrics.json."""
    metrics_path = resolve_metrics_file_path()

    if not metrics_path:
        logger.warning("Metrics file not found. Returning 404.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model metrics not available yet. Train the model first.",
        )

    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        return ModelMetricsResponse(**metrics_data)

    except Exception as exc:
        logger.error("Failed to read or parse metrics file (%s): %s", metrics_path, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model metrics not available yet. Train the model first.",
        )
