import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest

project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml.src.evaluate import (
    load_artifacts,
    perform_threshold_analysis,
    plot_confusion_matrix,
    plot_feature_importance,
    plot_precision_recall_curve,
    plot_roc_curve,
)


def test_load_artifacts():
    model, preprocessor, feature_names = load_artifacts()
    assert hasattr(model, "predict")
    assert hasattr(preprocessor, "transform")
    assert isinstance(feature_names, list)
    assert len(feature_names) > 0


def test_perform_threshold_analysis(tmp_path):
    np.random.seed(42)
    y_test = pd.Series([1, 0, 1, 0, 1, 0, 0, 0, 0, 0])
    y_proba = np.array([0.9, 0.1, 0.8, 0.2, 0.4, 0.1, 0.3, 0.05, 0.15, 0.25])

    csv_file = tmp_path / "thresh_test.csv"
    df = perform_threshold_analysis(y_test, y_proba, csv_file)

    assert csv_file.exists()
    assert len(df) == 9
    assert list(df.columns) == ["threshold", "precision", "recall", "f1_score", "tp", "fp", "fn", "tn"]
    assert (df["threshold"] >= 0.1).all() and (df["threshold"] <= 0.9).all()


def test_plot_generation(tmp_path):
    cm = np.array([[50, 2], [1, 10]])
    y_test = pd.Series([1] * 11 + [0] * 52)
    y_proba = np.random.uniform(0, 1, size=len(y_test))
    feature_names = [f"f_{i}" for i in range(10)]

    class DummyModel:
        feature_importances_ = np.random.uniform(0, 1, size=10)

    cm_path = tmp_path / "cm.png"
    pr_path = tmp_path / "pr.png"
    roc_path = tmp_path / "roc.png"
    fi_path = tmp_path / "fi.png"

    plot_confusion_matrix(cm, "TestModel", cm_path)
    plot_precision_recall_curve(y_test, y_proba, 0.85, "TestModel", pr_path)
    plot_roc_curve(y_test, y_proba, 0.95, "TestModel", roc_path)
    plot_feature_importance(DummyModel(), feature_names, "TestModel", fi_path)

    assert cm_path.exists()
    assert pr_path.exists()
    assert roc_path.exists()
    assert fi_path.exists()
