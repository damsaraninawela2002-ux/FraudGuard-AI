"""Unit tests for the ExplainService SHAP explainability engine.

FraudGuard AI – Explainable Fraud Detection System
"""

from unittest.mock import patch
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression

from app.schemas.transaction import FeatureContribution, TransactionInput
from app.services.explain_service import (
    FEATURE_ORDER,
    ExplainService,
    extract_positive_class_shap,
    get_explain_service,
)


@pytest.fixture
def sample_transaction_dict():
    return {
        "amount": 250000.0,
        "transaction_type": "TRANSFER",
        "hour_of_day": 2,
        "old_balance_origin": 250000.0,
        "new_balance_origin": 0.0,
        "old_balance_dest": 0.0,
        "new_balance_dest": 250000.0,
    }


@pytest.fixture
def sample_transaction_input(sample_transaction_dict):
    return TransactionInput(**sample_transaction_dict)


@pytest.fixture
def low_risk_transaction_input():
    return TransactionInput(
        amount=50.0,
        transaction_type="PAYMENT",
        hour_of_day=14,
        old_balance_origin=1500.0,
        new_balance_origin=1450.0,
        old_balance_dest=0.0,
        new_balance_dest=0.0,
    )



def test_explain_service_singleton():
    """Verify singleton accessor returns identical service instance."""
    svc1 = get_explain_service()
    svc2 = get_explain_service()
    assert svc1 is svc2


def test_extract_positive_class_shap_shapes():
    """Verify normalization of diverse SHAP output formats (lists, 2D, 3D arrays)."""
    # 1. 2D array (e.g. XGBoost margin)
    arr_2d = np.array([[0.5, -0.2, 1.1]])
    res_2d = extract_positive_class_shap(arr_2d)
    np.testing.assert_array_equal(res_2d, arr_2d)

    # 2. List of arrays (e.g. Random Forest binary classification [class_0, class_1])
    class_0 = np.array([[-0.5, 0.2, -1.1]])
    class_1 = np.array([[0.5, -0.2, 1.1]])
    res_list = extract_positive_class_shap([class_0, class_1])
    np.testing.assert_array_equal(res_list, class_1)

    # 3. 3D array (n_samples, n_features, n_classes)
    arr_3d = np.stack([class_0, class_1], axis=-1)
    res_3d = extract_positive_class_shap(arr_3d)
    np.testing.assert_array_equal(res_3d, class_1)


def test_explain_service_real_model_contributions(sample_transaction_input):
    """Verify production TreeExplainer feature attributions for a real transaction."""
    svc = ExplainService()
    svc.load_artifacts()

    assert svc.is_demo is False
    assert svc.explainer is not None
    assert svc.model is not None
    assert svc.preprocessor is not None

    # Test with TransactionInput
    top_features = svc.explain(sample_transaction_input)

    assert isinstance(top_features, list)
    assert len(top_features) == 5

    # Check schema types, ordering, and direction logic
    prev_abs_shap = float("inf")
    for feat in top_features:
        assert isinstance(feat, FeatureContribution)
        assert isinstance(feat.feature, str)
        assert isinstance(feat.shap_value, float)
        assert feat.direction in ["increases_risk", "decreases_risk"]

        # Verify direction logic: increases_risk if shap_value > 0 else decreases_risk
        if feat.shap_value > 0:
            assert feat.direction == "increases_risk"
        else:
            assert feat.direction == "decreases_risk"

        # Verify sorted in descending order of absolute magnitude
        curr_abs = abs(feat.shap_value)
        assert curr_abs <= prev_abs_shap + 1e-6
        prev_abs_shap = curr_abs

        # Verify one-hot transaction_type_* columns were unified into 'transaction_type'
        assert not feat.feature.startswith("transaction_type_")

        # Verify 4 decimal places rounding
        assert round(feat.shap_value, 4) == feat.shap_value


def test_explain_input_types(sample_transaction_dict, sample_transaction_input):
    """Verify explain() correctly accepts DataFrame, dict, and TransactionInput."""
    svc = ExplainService()
    svc.load_artifacts()

    # 1. pd.DataFrame input
    df_input = pd.DataFrame([sample_transaction_dict])
    feats_from_df = svc.explain(df_input)
    assert len(feats_from_df) == 5

    # 2. dict input with simulation step instead of hour_of_day
    dict_with_step = sample_transaction_dict.copy()
    del dict_with_step["hour_of_day"]
    dict_with_step["step"] = 50  # 50 % 24 = 2
    feats_from_dict = svc.explain(dict_with_step)
    assert len(feats_from_dict) == 5

    # 3. TransactionInput schema
    feats_from_model = svc.explain(sample_transaction_input)
    assert len(feats_from_model) == 5

    # Values should match between identical inputs
    assert [f.feature for f in feats_from_df] == [f.feature for f in feats_from_model]
    assert [f.shap_value for f in feats_from_df] == [f.shap_value for f in feats_from_model]


def test_explain_service_demo_mode_missing_artifacts(sample_transaction_input):
    """Verify graceful fallback to heuristic demo mode when artifacts are absent."""
    svc = ExplainService()

    # Force simulated missing files
    with patch("pathlib.Path.exists", return_value=False):
        svc.load_artifacts()
        assert svc.is_demo is True
        assert svc.explainer is None

    contributions = svc.explain(sample_transaction_input)
    assert len(contributions) == 5
    for item in contributions:
        assert isinstance(item, FeatureContribution)
        assert item.direction in ["increases_risk", "decreases_risk"]
        assert round(item.shap_value, 4) == item.shap_value

    record = svc.explain_record(sample_transaction_input)
    assert record["is_demo"] is True
    assert len(record["top_features"]) == 5


def test_explain_service_non_tree_model_fallback(sample_transaction_input):
    """Verify graceful fallback to demo mode when a non-tree model is provided."""
    # Fit a standard Logistic Regression model (incompatible with TreeExplainer)
    lr_model = LogisticRegression()
    lr_model.fit(
        np.array([[1, 2, 3, 4, 5, 6, 0, 1, 0, 0, 0], [2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 1]]),
        np.array([0, 1]),
    )

    svc = ExplainService()
    svc.load_artifacts()

    # Inject the non-tree model and reload
    with patch("joblib.load", side_effect=[svc.preprocessor, lr_model]):
        svc.load_artifacts()
        assert svc.is_demo is True
        assert svc.explainer is None

    # Should still generate valid explanations using heuristic fallback
    contributions = svc.explain(sample_transaction_input)
    assert len(contributions) == 5
    assert all(isinstance(c, FeatureContribution) for c in contributions)


def test_explain_invalid_input():
    """Verify validation errors on invalid or empty inputs."""
    svc = ExplainService()
    svc.load_artifacts()

    # Empty DataFrame
    with pytest.raises(ValueError, match="Cannot explain an empty DataFrame"):
        svc.explain(pd.DataFrame())

    # Missing mandatory features
    with pytest.raises(ValueError, match="Transaction input missing required features"):
        svc.explain({"amount": 100.0})

    # Unsupported type
    with pytest.raises(TypeError, match="Unsupported transaction input type"):
        svc.explain(12345)  # type: ignore


def test_real_model_output_dynamic(sample_transaction_input, low_risk_transaction_input):
    """Verify SHAP attributions reflect genuine model calculations and vary dynamically."""
    svc = ExplainService()
    svc.load_artifacts()
    assert svc.is_demo is False

    high_risk_feats = svc.explain(sample_transaction_input)
    low_risk_feats = svc.explain(low_risk_transaction_input)

    # Different transactions must yield different SHAP explanations
    high_risk_vals = [f.shap_value for f in high_risk_feats]
    low_risk_vals = [f.shap_value for f in low_risk_feats]
    assert high_risk_vals != low_risk_vals

    # High-risk transfer has old_balance_origin heavily driving risk
    high_risk_dict = {f.feature: f for f in high_risk_feats}
    if "old_balance_origin" in high_risk_dict:
        assert high_risk_dict["old_balance_origin"].direction == "increases_risk"

