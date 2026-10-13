import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest

project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml.src.explain import (
    explain_transaction,
    extract_positive_class_shap,
    get_explainer_artifacts,
    prepare_raw_dataframe,
)


def test_extract_positive_class_shap():
    # Test list format (e.g. binary classification [class_0, class_1])
    c0 = np.array([[0.1, 0.2]])
    c1 = np.array([[-0.1, -0.2]])
    res_list = extract_positive_class_shap([c0, c1])
    np.testing.assert_array_equal(res_list, c1)

    # Test 2D array format (single positive output)
    arr_2d = np.array([[1.5, 2.5]])
    res_2d = extract_positive_class_shap(arr_2d)
    np.testing.assert_array_equal(res_2d, arr_2d)

    # Test 3D array format (n_samples, n_features, n_classes)
    arr_3d = np.zeros((1, 5, 2))
    arr_3d[0, :, 1] = [1, 2, 3, 4, 5]
    res_3d = extract_positive_class_shap(arr_3d)
    np.testing.assert_array_equal(res_3d, arr_3d[..., 1])


def test_prepare_raw_dataframe():
    # Input with 'step' instead of 'hour_of_day'
    input_dict = {
        "step": 26,
        "amount": 1000.0,
        "old_balance_origin": 1000.0,
        "new_balance_origin": 0.0,
        "old_balance_dest": 500.0,
        "new_balance_dest": 1500.0,
        "transaction_type": "CASH_OUT",
        "nameOrig": "C12345",  # Extra col that should be ignored
    }
    df = prepare_raw_dataframe(input_dict)
    assert "hour_of_day" in df.columns
    assert df["hour_of_day"].iloc[0] == 2  # 26 % 24 = 2
    assert "nameOrig" not in df.columns
    assert "transaction_type" in df.columns


def test_explain_transaction():
    tx = {
        "hour_of_day": 14,
        "amount": 150000.0,
        "old_balance_origin": 150000.0,
        "new_balance_origin": 0.0,
        "old_balance_dest": 0.0,
        "new_balance_dest": 150000.0,
        "transaction_type": "TRANSFER",
    }

    explanations = explain_transaction(tx)

    # Must return top 5 features
    assert len(explanations) == 5

    for item in explanations:
        assert "feature" in item
        assert "shap_value" in item
        assert "direction" in item
        assert isinstance(item["shap_value"], float)
        assert item["direction"] in ["increases_risk", "decreases_risk"]

    # Verify one-hot transaction_type columns were merged into a single 'transaction_type'
    feature_names_returned = [item["feature"] for item in explanations]
    assert not any(f.startswith("transaction_type_") for f in feature_names_returned)
    # Check absolute descending order
    abs_values = [abs(item["shap_value"]) for item in explanations]
    assert abs_values == sorted(abs_values, reverse=True)
