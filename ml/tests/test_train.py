import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression

project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml.src.train import (
    evaluate_model_on_test_set,
    get_candidate_models,
    save_training_artifacts,
    train_and_compare_models,
)


@pytest.fixture
def synthetic_train_test_data():
    np.random.seed(42)
    n_train = 200
    n_test = 50
    n_features = 8

    X_train = np.random.randn(n_train, n_features)
    # 10% positive fraud class
    y_train = pd.Series((np.random.rand(n_train) < 0.1).astype(int))
    # Ensure at least 5 positive instances
    y_train.iloc[:5] = 1

    X_test = np.random.randn(n_test, n_features)
    y_test = pd.Series((np.random.rand(n_test) < 0.1).astype(int))
    y_test.iloc[:3] = 1

    return X_train, y_train, X_test, y_test


def test_get_candidate_models():
    models = get_candidate_models(scale_pos_weight=15.0)
    assert "Logistic Regression" in models
    assert "Random Forest" in models
    assert "XGBoost" in models

    assert models["Logistic Regression"].class_weight == "balanced"
    assert models["Logistic Regression"].max_iter == 1000

    assert models["Random Forest"].n_estimators == 200
    assert models["Random Forest"].class_weight == "balanced_subsample"

    assert models["XGBoost"].scale_pos_weight == 15.0
    assert models["XGBoost"].eval_metric == "aucpr"


def test_evaluate_model_on_test_set(synthetic_train_test_data):
    X_train, y_train, X_test, y_test = synthetic_train_test_data

    model = LogisticRegression(random_state=42)
    model.fit(X_train, y_train)

    metrics = evaluate_model_on_test_set(model, X_test, y_test)
    for k in ["precision", "recall", "f1", "pr_auc", "roc_auc"]:
        assert k in metrics
        assert 0.0 <= metrics[k] <= 1.0


def test_train_and_compare_models(synthetic_train_test_data):
    X_train, y_train, X_test, y_test = synthetic_train_test_data

    results, best_model, best_name = train_and_compare_models(
        X_train, y_train, X_test, y_test, cv_folds=2
    )

    assert len(results) == 3
    for name in ["Logistic Regression", "Random Forest", "XGBoost"]:
        assert name in results
        assert "test_metrics" in results[name]
        assert "cv_pr_auc_mean" in results[name]
        assert "training_time_seconds" in results[name]

    assert best_name in results
    assert hasattr(best_model, "predict")


def test_save_training_artifacts(synthetic_train_test_data, tmp_path):
    _, _, _, _ = synthetic_train_test_data
    model = LogisticRegression(random_state=42)

    results = {
        "Logistic Regression": {
            "cv_pr_auc_mean": 0.85,
            "cv_pr_auc_std": 0.02,
            "test_metrics": {
                "precision": 0.8,
                "recall": 0.9,
                "f1": 0.85,
                "pr_auc": 0.88,
                "roc_auc": 0.95,
            },
            "training_time_seconds": 0.05,
            "cv_time_seconds": 0.1,
            "total_time_seconds": 0.15,
        }
    }

    model_file = tmp_path / "model.joblib"
    metrics_file = tmp_path / "metrics.json"

    save_training_artifacts(
        best_model=model,
        best_model_name="Logistic Regression",
        results=results,
        model_path=model_file,
        metrics_path=metrics_file,
    )

    assert model_file.exists()
    assert metrics_file.exists()

    with open(metrics_file, "r") as f:
        data = json.load(f)
    assert data["best_model"] == "Logistic Regression"
    assert data["best_pr_auc"] == 0.88
