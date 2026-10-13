"""Model Training, Cross-Validation, and Comparison Module.

FraudGuard AI – Explainable Fraud Detection System

This module trains and compares candidate classification models:
1. Logistic Regression (class_weight="balanced", max_iter=1000)
2. Random Forest (n_estimators=200, class_weight="balanced_subsample", n_jobs=-1)
3. XGBoost (scale_pos_weight = n_legit/n_fraud, eval_metric="aucpr", n_jobs=-1)

Key Architectural & Evaluation Principles:
- Preprocessor is fit STRICTLY on training data only to avoid data leakage.
- Stratified 3-fold cross-validation on training data scored with PR-AUC (average_precision).
- Models evaluated on held-out test set for Precision, Recall, F1, PR-AUC, and ROC-AUC.
- SMOTE is intentionally avoided for tree ensembles in favor of algorithmic class weighting.
- The highest-performing model by PR-AUC is serialized to MODEL_PATH via joblib.
- Full model comparison metrics are exported as structured JSON to METRICS_PATH.
"""

from datetime import datetime
import json
import logging
from pathlib import Path
import sys
import time
from typing import Any, Dict, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from xgboost import XGBClassifier

# Add project root and ml root dynamically to sys.path
_CURRENT_DIR = Path(__file__).resolve().parent
_ML_ROOT = _CURRENT_DIR.parent
_PROJECT_ROOT = _ML_ROOT.parent

for _p in [str(_PROJECT_ROOT), str(_ML_ROOT)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from ml.src.config import (
        METRICS_PATH,
        MODEL_PATH,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        TARGET,
        TEST_SIZE,
    )
    from ml.src.preprocess import (
        build_preprocessor,
        load_data,
        save_preprocessor,
        split_data,
    )
except ImportError:
    from src.config import (
        METRICS_PATH,
        MODEL_PATH,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        TARGET,
        TEST_SIZE,
    )
    from src.preprocess import (
        build_preprocessor,
        load_data,
        save_preprocessor,
        split_data,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def get_candidate_models(scale_pos_weight: float) -> Dict[str, Any]:
    """Instantiate candidate classification models with required hyperparameters.

    WHY WE DO NOT USE SMOTE FOR TREE MODELS (Class Weights vs. SMOTE):
    ------------------------------------------------------------------
    1. Geometrical Inconsistency with Tree Splits:
       SMOTE generates synthetic observations by linear interpolation between nearest
       neighbors in continuous Euclidean feature space. Decision trees (Random Forest,
       XGBoost) make orthogonal axis-aligned splits. In extremely imbalanced datasets (~0.13% fraud),
       SMOTE frequently generates synthetic points in unpopulated, noisy, or ambiguous
       decision regions, blurring sharp split boundaries and degrading test precision.
    2. Algorithmic Cost-Sensitive Weighting is Superior:
       Tree algorithms handle severe imbalance natively and effectively via class weighting
       (`class_weight="balanced_subsample"` in Random Forest, `scale_pos_weight` in XGBoost).
       This penalizes false negatives directly within the loss function / impurity calculation
       without falsifying underlying feature manifolds or synthesizing artificial data.
    3. Scalability & Memory Efficiency:
       Synthesizing minority instances across millions of rows dramatically multiplies
       memory footprint and training wall time. Class weighting adds zero computational
       overhead and scales effortlessly to the full multi-million-row PaySim dataset.

    Parameters
    ----------
    scale_pos_weight : float
        Ratio of negative (legitimate) to positive (fraudulent) training instances,
        passed to XGBoost to weight positive gradient contributions.

    Returns
    -------
    dict of {str: estimator}
        Configured model instances.
    """
    models = {
        "Logistic Regression": LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=RANDOM_STATE,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),
        "XGBoost": XGBClassifier(
            scale_pos_weight=scale_pos_weight,
            eval_metric="aucpr",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    }
    return models


def evaluate_model_on_test_set(
    model: Any,
    X_test: np.ndarray,
    y_test: pd.Series,
) -> Dict[str, float]:
    """Compute classification metrics for the fraud class (label 1) on held-out test set."""
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    precision = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
    recall = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
    pr_auc = float(average_precision_score(y_test, y_proba))
    roc_auc = float(roc_auc_score(y_test, y_proba))

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
    }


def train_and_compare_models(
    X_train: np.ndarray,
    y_train: pd.Series,
    X_test: np.ndarray,
    y_test: pd.Series,
    cv_folds: int = 3,
) -> Tuple[Dict[str, Any], Any, str]:
    """Train candidate models, run 3-fold stratified cross-validation, and evaluate on test set.

    Parameters
    ----------
    X_train : np.ndarray
        Preprocessed training features.
    y_train : pd.Series
        Training labels.
    X_test : np.ndarray
        Preprocessed test features.
    y_test : pd.Series
        Test labels.
    cv_folds : int, default 3
        Number of stratified cross-validation folds.

    Returns
    -------
    Tuple[Dict[str, Any], Any, str]
        (comparison_results, best_model_instance, best_model_name)
    """
    n_fraud = int((y_train == 1).sum())
    n_legit = int((y_train == 0).sum())
    scale_pos_weight = float(n_legit / max(1, n_fraud))

    logger.info(
        "Training partition: %d legitimate, %d fraud cases. XGBoost scale_pos_weight = %.2f",
        n_legit,
        n_fraud,
        scale_pos_weight,
    )

    models = get_candidate_models(scale_pos_weight)
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=RANDOM_STATE)

    results: Dict[str, Any] = {}
    fitted_models: Dict[str, Any] = {}

    for name, model in models.items():
        logger.info("-" * 60)
        logger.info("Evaluating %s...", name)

        # 1. Stratified Cross-Validation on training set scored with PR-AUC (average_precision)
        logger.info("Running %d-fold stratified cross-validation (metric: average_precision)...", cv_folds)
        cv_start = time.perf_counter()
        cv_scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=cv,
            scoring="average_precision",
            n_jobs=1,  # RF & XGB already utilize all cores via n_jobs=-1
        )
        cv_time = time.perf_counter() - cv_start
        cv_mean = float(np.mean(cv_scores))
        cv_std = float(np.std(cv_scores))
        logger.info(
            "%s CV PR-AUC: %.4f (+/- %.4f) [CV took %.2fs]",
            name,
            cv_mean,
            cv_std,
            cv_time,
        )

        # 2. Fit model on full training set
        logger.info("Fitting %s on full training partition...", name)
        fit_start = time.perf_counter()
        model.fit(X_train, y_train)
        fit_time = time.perf_counter() - fit_start
        logger.info("%s training completed in %.2fs", name, fit_time)

        fitted_models[name] = model

        # 3. Evaluate on held-out test set
        test_metrics = evaluate_model_on_test_set(model, X_test, y_test)
        logger.info(
            "%s Test Metrics -> PR-AUC: %.4f | F1: %.4f | Precision: %.4f | Recall: %.4f | ROC-AUC: %.4f",
            name,
            test_metrics["pr_auc"],
            test_metrics["f1"],
            test_metrics["precision"],
            test_metrics["recall"],
            test_metrics["roc_auc"],
        )

        results[name] = {
            "cv_pr_auc_mean": round(cv_mean, 4),
            "cv_pr_auc_std": round(cv_std, 4),
            "test_metrics": test_metrics,
            "training_time_seconds": round(fit_time, 2),
            "cv_time_seconds": round(cv_time, 2),
            "total_time_seconds": round(fit_time + cv_time, 2),
        }

    # Select best model by PR-AUC on held-out test set
    best_model_name = max(results.keys(), key=lambda m: results[m]["test_metrics"]["pr_auc"])
    best_model_instance = fitted_models[best_model_name]

    return results, best_model_instance, best_model_name


def print_comparison_table(results: Dict[str, Any]) -> None:
    """Print an ASCII comparison table of test metrics and training times."""
    header = (
        f"{'Model':<22} | {'Precision':<9} | {'Recall':<8} | {'F1':<8} | "
        f"{'PR-AUC':<8} | {'ROC-AUC':<8} | {'CV PR-AUC (3-Fold)':<20} | {'Train Time':<10}"
    )
    separator = "-" * len(header)

    print("\n" + "=" * len(header))
    print("MODEL COMPARISON RESULTS (Held-Out Test Set - Fraud Class)")
    print("=" * len(header))
    print(header)
    print(separator)

    for name, data in results.items():
        m = data["test_metrics"]
        cv_str = f"{data['cv_pr_auc_mean']:.4f} +/- {data['cv_pr_auc_std']:.4f}"
        t_str = f"{data['training_time_seconds']:.2f}s"
        row = (
            f"{name:<22} | {m['precision']:<9.4f} | {m['recall']:<8.4f} | {m['f1']:<8.4f} | "
            f"{m['pr_auc']:<8.4f} | {m['roc_auc']:<8.4f} | {cv_str:<20} | {t_str:<10}"
        )
        print(row)

    print("=" * len(header) + "\n")


def save_training_artifacts(
    best_model: Any,
    best_model_name: str,
    results: Dict[str, Any],
    model_path: Union[str, Path] = MODEL_PATH,
    metrics_path: Union[str, Path] = METRICS_PATH,
) -> None:
    """Serialize the top-performing model and output JSON comparison report."""
    mod_path = Path(model_path)
    met_path = Path(metrics_path)

    mod_path.parent.mkdir(parents=True, exist_ok=True)
    met_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Save best model with joblib
    joblib.dump(best_model, mod_path)
    logger.info("Saved best model (%s) to: %s", best_model_name, mod_path.resolve())

    # 2. Structure metrics report
    report = {
        "best_model": best_model_name,
        "selection_metric": "test_pr_auc",
        "best_pr_auc": results[best_model_name]["test_metrics"]["pr_auc"],
        "comparison": results,
        "timestamp": datetime.now().isoformat(),
    }

    with open(met_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    logger.info("Saved model comparison report to: %s", met_path.resolve())


def run_training_pipeline(
    raw_path: Optional[Union[str, Path]] = None,
    sample_legit_ratio: Optional[float] = None,
    save_artifacts: bool = True,
) -> Tuple[Dict[str, Any], Any, str]:
    """Execute end-to-end training, CV, test evaluation, and artifact serialization.

    1. Loads dataset with optional undersampling of majority class.
    2. Performs stratified train/test split.
    3. Builds and fits ColumnTransformer on X_train only.
    4. Transforms X_train and X_test.
    5. Runs stratified 3-fold CV and test evaluations for all 3 models.
    6. Identifies best model by PR-AUC.
    7. Persists best model to MODEL_PATH and metrics to METRICS_PATH.
    """
    total_start = time.perf_counter()

    # 1. Load data
    logger.info("Loading transaction data...")
    df = load_data(raw_path=raw_path, sample_legit_ratio=sample_legit_ratio)

    # 2. Stratified train/test split (leakage prevention)
    X_train_raw, X_test_raw, y_train, y_test = split_data(df)

    # 3. Fit preprocessor on X_train ONLY
    logger.info("Building and fitting ColumnTransformer on X_train only...")
    preprocessor = build_preprocessor()
    preprocessor.fit(X_train_raw)

    if save_artifacts:
        save_preprocessor(preprocessor)

    # 4. Transform features
    X_train = preprocessor.transform(X_train_raw)
    X_test = preprocessor.transform(X_test_raw)

    # 5. Train and compare models
    results, best_model, best_model_name = train_and_compare_models(
        X_train=X_train,
        y_train=y_train,
        X_test=X_test,
        y_test=y_test,
        cv_folds=3,
    )

    # 6. Display comparison table
    print_comparison_table(results)

    best_score = results[best_model_name]["test_metrics"]["pr_auc"]
    print(f"Top-Performing Model: {best_model_name} (PR-AUC: {best_score:.4f})")

    # 7. Persist artifacts
    if save_artifacts:
        save_training_artifacts(
            best_model=best_model,
            best_model_name=best_model_name,
            results=results,
        )

    total_time = time.perf_counter() - total_start
    logger.info("Full training pipeline completed in %.2fs", total_time)

    return results, best_model, best_model_name


if __name__ == "__main__":
    print("=" * 70)
    print("FraudGuard AI - Model Training & Evaluation Pipeline")
    print("=" * 70)

    target_raw = Path(RAW_DATA_PATH)
    demo_file = None

    if not target_raw.exists():
        print(f"\n[Notice] Raw PaySim dataset not found at: {target_raw.resolve()}")
        print("Generating a representative sample to execute and verify training pipeline...\n")

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

        # Inject fraud exclusively in TRANSFER and CASH_OUT with account draining pattern
        fraud_candidates = mock_df[mock_df["type"].isin(["TRANSFER", "CASH_OUT"])].index
        fraud_idx = np.random.choice(fraud_candidates, size=int(n_samples * 0.005), replace=False)
        mock_df.loc[fraud_idx, "isFraud"] = 1
        mock_df.loc[fraud_idx, "newbalanceOrig"] = 0.0
        mock_df.loc[fraud_idx, "amount"] = mock_df.loc[fraud_idx, "oldbalanceOrg"]

        demo_file = target_raw.parent / "_demo_train_sample.csv"
        mock_df.to_csv(demo_file, index=False)
        effective_path = demo_file
        legit_ratio = None
    else:
        effective_path = target_raw
        # When running full dataset, use sample_legit_ratio=20 if requested for faster exploration
        legit_ratio = 20

    try:
        run_training_pipeline(
            raw_path=effective_path,
            sample_legit_ratio=legit_ratio,
            save_artifacts=True,
        )
    finally:
        if demo_file and demo_file.exists():
            demo_file.unlink()
