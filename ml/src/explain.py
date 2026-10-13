"""SHAP-based Model Explainability Module.

FraudGuard AI – Explainable Fraud Detection System

This module provides:
1. TreeExplainer generation for tree-based ensemble models (XGBoost, Random Forest).
2. `explain_transaction(raw_input_dict)`: Local feature attribution producing top 5
   risk-driving or risk-mitigating features for a single transaction.
   - Merges one-hot transaction_type columns into a unified "transaction_type" contribution.
   - Normalizes SHAP output formats (list per class vs. 2D/3D array).
   - Labels direction as "increases_risk" (positive attribution toward fraud)
     or "decreases_risk" (negative attribution pushing toward legitimate).
3. Global SHAP summary visualization on a 2,000-row test sample saved to
   `ml/reports/shap_summary.png`.
"""

import json
import logging
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

# Resolve paths dynamically
_CURRENT_DIR = Path(__file__).resolve().parent
_ML_ROOT = _CURRENT_DIR.parent
_PROJECT_ROOT = _ML_ROOT.parent

for _p in [str(_PROJECT_ROOT), str(_ML_ROOT)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from ml.src.config import (
        CATEGORICAL_FEATURES,
        FEATURE_NAMES_PATH,
        MODEL_PATH,
        NUMERIC_FEATURES,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        REPORTS_DIR,
    )
    from ml.src.preprocess import (
        load_data,
        split_data,
    )
except ImportError:
    from src.config import (
        CATEGORICAL_FEATURES,
        FEATURE_NAMES_PATH,
        MODEL_PATH,
        NUMERIC_FEATURES,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        REPORTS_DIR,
    )
    from src.preprocess import (
        load_data,
        split_data,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Cached runtime artifacts
_MODEL = None
_PREPROCESSOR = None
_EXPLAINER = None
_FEATURE_NAMES = None


def load_artifacts(
    model_path: Union[str, Path] = MODEL_PATH,
    preprocessor_path: Union[str, Path] = PREPROCESSOR_PATH,
    feature_names_path: Union[str, Path] = FEATURE_NAMES_PATH,
) -> Tuple[Any, Any, List[str]]:
    """Load the trained model, fitted preprocessor, and feature names list."""
    mod_p = Path(model_path)
    prep_p = Path(preprocessor_path)
    feat_p = Path(feature_names_path)

    if not mod_p.exists():
        raise FileNotFoundError(f"Model artifact not found at: {mod_p.resolve()}")
    if not prep_p.exists():
        raise FileNotFoundError(f"Preprocessor artifact not found at: {prep_p.resolve()}")

    model = joblib.load(mod_p)
    preprocessor = joblib.load(prep_p)

    feature_names: List[str] = []
    if feat_p.exists():
        with open(feat_p, "r", encoding="utf-8") as f:
            feature_names = json.load(f)
    elif hasattr(preprocessor, "get_feature_names_out"):
        feature_names = list(preprocessor.get_feature_names_out())

    return model, preprocessor, feature_names


def get_explainer_artifacts() -> Tuple[Any, Any, shap.TreeExplainer, List[str]]:
    """Lazily load and cache the model, preprocessor, TreeExplainer, and feature names."""
    global _MODEL, _PREPROCESSOR, _EXPLAINER, _FEATURE_NAMES

    if _EXPLAINER is None or _MODEL is None or _PREPROCESSOR is None:
        logger.info("Initializing cached TreeExplainer and preprocessing artifacts...")
        _MODEL, _PREPROCESSOR, _FEATURE_NAMES = load_artifacts()
        _EXPLAINER = shap.TreeExplainer(_MODEL)

    return _MODEL, _PREPROCESSOR, _EXPLAINER, _FEATURE_NAMES


def extract_positive_class_shap(shap_output: Union[List[np.ndarray], np.ndarray]) -> np.ndarray:
    """Extract SHAP attribution values for the positive (fraud) class.

    Handles different SHAP library return structures:
    - List of arrays per class (e.g. [shap_class_0, shap_class_1]): index 1 is taken.
    - 3D array (n_samples, n_features, n_classes): index 1 along the class axis is taken.
    - 2D array (n_samples, n_features): single-output models (e.g. XGBoost binary log-odds).
    """
    if isinstance(shap_output, list):
        # Multi-output / Random Forest list format
        pos_values = shap_output[1] if len(shap_output) > 1 else shap_output[0]
    elif isinstance(shap_output, np.ndarray):
        if shap_output.ndim == 3 and shap_output.shape[-1] >= 2:
            pos_values = shap_output[..., 1]
        else:
            pos_values = shap_output
    elif hasattr(shap_output, "values"):
        # shap.Explanation object
        vals = shap_output.values
        if vals.ndim == 3 and vals.shape[-1] >= 2:
            pos_values = vals[..., 1]
        else:
            pos_values = vals
    else:
        pos_values = np.asarray(shap_output)

    return pos_values


def prepare_raw_dataframe(raw_input: Union[Dict[str, Any], pd.DataFrame]) -> pd.DataFrame:
    """Validate and align raw transaction fields with the preprocessor schema."""
    if isinstance(raw_input, dict):
        record = raw_input.copy()
        if "step" in record and "hour_of_day" not in record:
            record["hour_of_day"] = record["step"] % 24
        df = pd.DataFrame([record])
    else:
        df = raw_input.copy()
        if "step" in df.columns and "hour_of_day" not in df.columns:
            df["hour_of_day"] = df["step"] % 24

    required = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Input is missing required features: {missing}")

    return df[required]


def explain_transaction(
    raw_input_dict: Dict[str, Any],
    model: Optional[Any] = None,
    preprocessor: Optional[Any] = None,
    explainer: Optional[Any] = None,
    feature_names: Optional[List[str]] = None,
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """Explain a single transaction by computing top local SHAP feature attributions.

    Parameters
    ----------
    raw_input_dict : dict
        Unprocessed transaction attributes (e.g., amount, old_balance_origin,
        transaction_type, etc.).
    model : estimator, optional
        Trained model instance (loads cached if None).
    preprocessor : ColumnTransformer, optional
        Fitted ColumnTransformer (loads cached if None).
    explainer : TreeExplainer, optional
        SHAP TreeExplainer instance (loads cached if None).
    feature_names : list of str, optional
        Transformed feature names (loads cached if None).
    top_n : int, default 5
        Number of top contributing features to return.

    Returns
    -------
    list of dict
        Top contributing features sorted by absolute SHAP impact:
        [
            {
                "feature": "old_balance_origin",
                "shap_value": 1.2541,
                "direction": "increases_risk"  # or "decreases_risk"
            },
            ...
        ]
    """
    if model is None or preprocessor is None or explainer is None or feature_names is None:
        def_mod, def_prep, def_expl, def_names = get_explainer_artifacts()
        model = model or def_mod
        preprocessor = preprocessor or def_prep
        explainer = explainer or def_expl
        feature_names = feature_names or def_names

    # 1. Prepare and transform the input transaction
    df_raw = prepare_raw_dataframe(raw_input_dict)
    X_transformed = preprocessor.transform(df_raw)

    # 2. Compute raw SHAP values
    shap_raw = explainer.shap_values(X_transformed)
    pos_shap = extract_positive_class_shap(shap_raw)

    # Flatten to 1D vector corresponding to the single row
    if pos_shap.ndim > 1:
        shap_vector = pos_shap[0]
    else:
        shap_vector = pos_shap

    # 3. Merge one-hot columns of transaction_type into a single feature contribution
    merged_contributions: Dict[str, float] = {}

    for name, val in zip(feature_names, shap_vector):
        val_float = float(val)
        if name.startswith("transaction_type"):
            # Aggregate all one-hot encoded categories for transaction_type
            merged_contributions["transaction_type"] = (
                merged_contributions.get("transaction_type", 0.0) + val_float
            )
        else:
            merged_contributions[name] = val_float

    # 4. Rank features by absolute SHAP impact
    ranked = sorted(
        merged_contributions.items(),
        key=lambda item: abs(item[1]),
        reverse=True,
    )

    # 5. Format output records
    top_explanations: List[Dict[str, Any]] = []
    for fname, sval in ranked[:top_n]:
        direction = "increases_risk" if sval > 0 else "decreases_risk"
        top_explanations.append({
            "feature": fname,
            "shap_value": round(float(sval), 4),
            "direction": direction,
        })

    return top_explanations


def generate_global_shap_summary(
    output_path: Union[str, Path] = REPORTS_DIR / "shap_summary.png",
    raw_path: Optional[Union[str, Path]] = None,
    sample_size: int = 2000,
) -> Path:
    """Generate and save global SHAP summary plot on a test sample."""
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    model, preprocessor, explainer, feature_names = get_explainer_artifacts()

    # Load test partition
    logger.info("Loading test data for global SHAP summary plot...")
    df = load_data(raw_path=raw_path)
    _, X_test_raw, _, _ = split_data(df)

    actual_sample_size = min(sample_size, len(X_test_raw))
    logger.info("Sampling %d rows from test set for SHAP summary...", actual_sample_size)
    sample_raw = X_test_raw.sample(n=actual_sample_size, random_state=RANDOM_STATE)

    # Transform sample
    X_sample_trans = preprocessor.transform(sample_raw)

    # Compute SHAP values
    logger.info("Calculating SHAP values for global summary...")
    shap_raw = explainer.shap_values(X_sample_trans)
    sample_shap = extract_positive_class_shap(shap_raw)

    # Create summary plot
    fig = plt.figure(figsize=(10, 6.5))
    shap.summary_plot(
        sample_shap,
        X_sample_trans,
        feature_names=feature_names,
        show=False,
        max_display=12,
    )
    plt.title(
        f"Global SHAP Feature Attribution Summary ({type(model).__name__})",
        fontsize=13,
        fontweight="bold",
        pad=14,
    )
    plt.tight_layout()
    plt.savefig(out_p, dpi=300, bbox_inches="tight")
    plt.close(fig)

    logger.info("Saved global SHAP summary plot to: %s", out_p.resolve())
    return out_p


if __name__ == "__main__":
    print("=" * 70)
    print("FraudGuard AI - SHAP Explainability Suite")
    print("=" * 70)

    target_raw = Path(RAW_DATA_PATH)
    demo_file = None

    if not target_raw.exists():
        print(f"\n[Notice] Raw PaySim dataset not found at: {target_raw.resolve()}")
        print("Generating a representative sample to test SHAP explanations...\n")

        np.random.seed(RANDOM_STATE)
        n_samples = 30000
        mock_df = pd.DataFrame({
            "step": np.random.randint(1, 744, size=n_samples),
            "type": np.random.choice(
                ["CASH_OUT", "PAYMENT", "CASH_IN", "TRANSFER", "DEBIT"],
                size=n_samples,
                p=[0.35, 0.34, 0.22, 0.08, 0.01],
            ),
            "amount": np.random.exponential(scale=150000, size=n_samples).round(2),
            "nameOrig": [f"C{np.random.randint(1000000, 9999999)}" for _ in range(n_samples)],
            "oldbalanceOrg": np.random.exponential(scale=200000, size=n_samples).round(2),
            "newbalanceOrig": 0.0,
            "nameDest": [f"M{np.random.randint(1000000, 9999999)}" for _ in range(n_samples)],
            "oldbalanceDest": np.random.exponential(scale=250000, size=n_samples).round(2),
            "newbalanceDest": 0.0,
            "isFraud": 0,
            "isFlaggedFraud": 0,
        })
        mock_df["newbalanceOrig"] = (mock_df["oldbalanceOrg"] - mock_df["amount"]).clip(lower=0)
        mock_df["newbalanceDest"] = mock_df["oldbalanceDest"] + mock_df["amount"]

        fraud_candidates = mock_df[mock_df["type"].isin(["TRANSFER", "CASH_OUT"])].index
        fraud_idx = np.random.choice(fraud_candidates, size=int(n_samples * 0.005), replace=False)
        mock_df.loc[fraud_idx, "isFraud"] = 1
        mock_df.loc[fraud_idx, "newbalanceOrig"] = 0.0
        mock_df.loc[fraud_idx, "amount"] = mock_df.loc[fraud_idx, "oldbalanceOrg"]

        demo_file = target_raw.parent / "_demo_explain_sample.csv"
        mock_df.to_csv(demo_file, index=False)
        effective_path = demo_file
    else:
        effective_path = target_raw

    try:
        # Load test set to pick real fraud and legitimate examples
        df_test = load_data(raw_path=effective_path)
        _, X_test_part, _, y_test_part = split_data(df_test)

        fraud_rows = y_test_part[y_test_part == 1].index
        legit_rows = y_test_part[y_test_part == 0].index

        # 1. Test Fraud Example
        fraud_sample = X_test_part.loc[fraud_rows[0]].to_dict()
        fraud_explanations = explain_transaction(fraud_sample)

        print("\n" + "=" * 65)
        print("TRANSACTION 1: CONFIRMED FRAUD (Ground Truth = 1)")
        print("=" * 65)
        print("Input Parameters:")
        for k, v in fraud_sample.items():
            print(f"  {k:<20}: {v}")
        print("\nTop 5 SHAP Attribution Drivers (Fraud Class):")
        for i, item in enumerate(fraud_explanations, 1):
            sign = "+" if item["direction"] == "increases_risk" else "-"
            print(f"  {i}. {item['feature']:<22} | SHAP: {sign}{abs(item['shap_value']):<7.4f} | {item['direction']}")

        # 2. Test Legitimate Example
        legit_sample = X_test_part.loc[legit_rows[0]].to_dict()
        legit_explanations = explain_transaction(legit_sample)

        print("\n" + "=" * 65)
        print("TRANSACTION 2: LEGITIMATE TRANSFER (Ground Truth = 0)")
        print("=" * 65)
        print("Input Parameters:")
        for k, v in legit_sample.items():
            print(f"  {k:<20}: {v}")
        print("\nTop 5 SHAP Attribution Drivers (Fraud Class):")
        for i, item in enumerate(legit_explanations, 1):
            sign = "+" if item["direction"] == "increases_risk" else "-"
            print(f"  {i}. {item['feature']:<22} | SHAP: {sign}{abs(item['shap_value']):<7.4f} | {item['direction']}")

        # 3. Generate Global SHAP Summary Plot
        print("\n" + "=" * 65)
        print("GENERATING GLOBAL SHAP SUMMARY PLOT (2,000-Row Sample)")
        print("=" * 65)
        summary_img = generate_global_shap_summary(
            output_path=REPORTS_DIR / "shap_summary.png",
            raw_path=effective_path,
            sample_size=2000,
        )
        print(f"Global SHAP summary plot successfully saved to: {summary_img.resolve()}")

    finally:
        if demo_file and demo_file.exists():
            demo_file.unlink()
