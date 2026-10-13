"""Model Evaluation and Diagnostic Reporting Module.

FraudGuard AI – Explainable Fraud Detection System

This module loads the trained production model and ColumnTransformer preprocessor,
evaluates performance on the held-out test partition, and generates:
1. metrics.json (exact required schema)
2. confusion_matrix.png
3. precision_recall_curve.png (with PR-AUC in title)
4. roc_curve.png
5. feature_importance.png (top 10 features)
6. threshold_analysis.csv (thresholds 0.1 to 0.9)
7. A plain-language summary of financial risk tradeoffs and a warning explaining
   why standard classification accuracy is misleading in fraud detection.
"""

from datetime import datetime
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
import seaborn as sns
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

# Dynamic path resolution
_CURRENT_DIR = Path(__file__).resolve().parent
_ML_ROOT = _CURRENT_DIR.parent
_PROJECT_ROOT = _ML_ROOT.parent

for _p in [str(_PROJECT_ROOT), str(_ML_ROOT)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from ml.src.config import (
        FEATURE_NAMES_PATH,
        METRICS_PATH,
        MODEL_PATH,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        REPORTS_DIR,
        TARGET,
        TEST_SIZE,
    )
    from ml.src.preprocess import (
        build_preprocessor,
        load_data,
        load_preprocessor,
        split_data,
    )
except ImportError:
    from src.config import (
        FEATURE_NAMES_PATH,
        METRICS_PATH,
        MODEL_PATH,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        REPORTS_DIR,
        TARGET,
        TEST_SIZE,
    )
    from src.preprocess import (
        build_preprocessor,
        load_data,
        load_preprocessor,
        split_data,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_artifacts(
    model_path: Union[str, Path] = MODEL_PATH,
    preprocessor_path: Union[str, Path] = PREPROCESSOR_PATH,
    feature_names_path: Union[str, Path] = FEATURE_NAMES_PATH,
) -> Tuple[Any, Any, List[str]]:
    """Load the serialized model, preprocessor, and feature names list."""
    mod_p = Path(model_path)
    prep_p = Path(preprocessor_path)
    feat_p = Path(feature_names_path)

    if not mod_p.exists():
        raise FileNotFoundError(f"Model artifact not found at: {mod_p.resolve()}")
    if not prep_p.exists():
        raise FileNotFoundError(f"Preprocessor artifact not found at: {prep_p.resolve()}")

    logger.info("Loading model from %s...", mod_p.resolve())
    model = joblib.load(mod_p)

    logger.info("Loading preprocessor from %s...", prep_p.resolve())
    preprocessor = joblib.load(prep_p)

    feature_names: List[str] = []
    if feat_p.exists():
        with open(feat_p, "r", encoding="utf-8") as f:
            feature_names = json.load(f)
    elif hasattr(preprocessor, "get_feature_names_out"):
        feature_names = list(preprocessor.get_feature_names_out())

    return model, preprocessor, feature_names


def plot_confusion_matrix(
    cm: np.ndarray,
    model_name: str,
    output_path: Union[str, Path],
) -> None:
    """Generate and save the confusion matrix heatmap."""
    fig, ax = plt.subplots(figsize=(6.5, 5.2))
    annot = [
        [f"{cm[0, 0]:,}\n(True Neg)", f"{cm[0, 1]:,}\n(False Pos)"],
        [f"{cm[1, 0]:,}\n(False Neg)", f"{cm[1, 1]:,}\n(True Pos)"],
    ]

    sns.heatmap(
        cm,
        annot=annot,
        fmt="",
        cmap="Blues",
        cbar=True,
        linewidths=1.0,
        linecolor="white",
        xticklabels=["Predicted Legit", "Predicted Fraud"],
        yticklabels=["Actual Legit", "Actual Fraud"],
        ax=ax,
    )

    ax.set_title(f"Confusion Matrix – {model_name} (Threshold = 0.5)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11, labelpad=8)
    ax.set_ylabel("True Label", fontsize=11, labelpad=8)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close(fig)
    logger.info("Saved confusion matrix plot to: %s", Path(output_path).resolve())


def plot_precision_recall_curve(
    y_test: pd.Series,
    y_proba: np.ndarray,
    pr_auc: float,
    model_name: str,
    output_path: Union[str, Path],
) -> None:
    """Generate and save the Precision-Recall curve with PR-AUC in title."""
    precisions, recalls, _ = precision_recall_curve(y_test, y_proba)
    baseline = float(y_test.mean())

    fig, ax = plt.subplots(figsize=(7, 5.2))
    ax.plot(recalls, precisions, color="#e74c3c", lw=2.5, label=f"{model_name} (PR-AUC = {pr_auc:.4f})")
    ax.axhline(baseline, color="gray", linestyle="--", lw=1.5, label=f"No-Skill Baseline ({baseline:.4f})")

    ax.set_title(f"Precision-Recall Curve (PR-AUC = {pr_auc:.4f})", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Recall (Detection Rate)", fontsize=11)
    ax.set_ylabel("Precision (Positive Predictive Value)", fontsize=11)
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.grid(True, linestyle="--", alpha=0.6)
    ax.legend(loc="lower left", fontsize=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close(fig)
    logger.info("Saved Precision-Recall curve to: %s", Path(output_path).resolve())


def plot_roc_curve(
    y_test: pd.Series,
    y_proba: np.ndarray,
    roc_auc: float,
    model_name: str,
    output_path: Union[str, Path],
) -> None:
    """Generate and save the Receiver Operating Characteristic (ROC) curve."""
    fpr, tpr, _ = roc_curve(y_test, y_proba)

    fig, ax = plt.subplots(figsize=(7, 5.2))
    ax.plot(fpr, tpr, color="#2980b9", lw=2.5, label=f"{model_name} (ROC-AUC = {roc_auc:.4f})")
    ax.plot([0, 1], [0, 1], color="gray", linestyle="--", lw=1.5, label="Random Classifier (ROC-AUC = 0.50)")

    ax.set_title(f"ROC Curve (ROC-AUC = {roc_auc:.4f})", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("False Positive Rate (1 - Specificity)", fontsize=11)
    ax.set_ylabel("True Positive Rate (Recall / Sensitivity)", fontsize=11)
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.grid(True, linestyle="--", alpha=0.6)
    ax.legend(loc="lower right", fontsize=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close(fig)
    logger.info("Saved ROC curve to: %s", Path(output_path).resolve())


def plot_feature_importance(
    model: Any,
    feature_names: List[str],
    model_name: str,
    output_path: Union[str, Path],
    top_n: int = 10,
) -> None:
    """Generate and save top N feature importances."""
    if hasattr(model, "feature_importances_"):
        raw_importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        raw_importances = np.abs(model.coef_[0])
    else:
        raw_importances = np.ones(len(feature_names))

    # Match names with importances
    names = feature_names if len(feature_names) == len(raw_importances) else [f"Feature {i}" for i in range(len(raw_importances))]

    imp_df = pd.DataFrame({
        "feature": names,
        "importance": raw_importances,
    }).sort_values(by="importance", ascending=False).head(top_n)

    fig, ax = plt.subplots(figsize=(8, 5.2))
    sns.barplot(
        data=imp_df,
        x="importance",
        y="feature",
        hue="feature",
        palette="viridis",
        legend=False,
        edgecolor="black",
        ax=ax,
    )

    ax.set_title(f"Top {top_n} Feature Importances ({model_name})", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Relative Importance Score", fontsize=11)
    ax.set_ylabel("Feature", fontsize=11)
    ax.grid(axis="x", linestyle="--", alpha=0.6)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close(fig)
    logger.info("Saved feature importance plot to: %s", Path(output_path).resolve())


def perform_threshold_analysis(
    y_test: pd.Series,
    y_proba: np.ndarray,
    output_path: Union[str, Path],
) -> pd.DataFrame:
    """Evaluate precision, recall, and F1 across decision thresholds 0.1 to 0.9."""
    thresholds = [round(float(t), 2) for t in np.arange(0.1, 0.91, 0.1)]
    records: List[Dict[str, Any]] = []

    for t in thresholds:
        preds = (y_proba >= t).astype(int)
        p = float(precision_score(y_test, preds, pos_label=1, zero_division=0))
        r = float(recall_score(y_test, preds, pos_label=1, zero_division=0))
        f1 = float(f1_score(y_test, preds, pos_label=1, zero_division=0))

        cm = confusion_matrix(y_test, preds)
        tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

        records.append({
            "threshold": t,
            "precision": round(p, 4),
            "recall": round(r, 4),
            "f1_score": round(f1, 4),
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
        })

    thresh_df = pd.DataFrame(records)
    thresh_df.to_csv(output_path, index=False)
    logger.info("Saved threshold analysis table to: %s", Path(output_path).resolve())
    return thresh_df


def print_plain_language_summary(
    metrics: Dict[str, Any],
    thresh_df: pd.DataFrame,
    total_test: int,
) -> None:
    """Print an interpretable financial executive summary and accuracy warning."""
    cm = metrics["confusion_matrix"]
    tn, fp, fn, tp = cm["tn"], cm["fp"], cm["fn"], cm["tp"]
    total_fraud = fn + tp
    total_legit = tn + fp

    print("\n" + "=" * 78)
    print("EXECUTIVE EVALUATION SUMMARY -- FRAUDGUARD AI")
    print("=" * 78)
    print(f"Model Evaluated     : {metrics['model_name']}")
    print(f"Decision Threshold  : {metrics['threshold']}")
    print(f"Test Partition Size : {total_test:,} transactions ({total_fraud:,} Fraud, {total_legit:,} Legitimate)")
    print("-" * 78)
    print(f"  - Precision (PPV) : {metrics['precision']:.4f}  ({metrics['precision']*100:.1f}% of flagged transactions were actual fraud)")
    print(f"  - Recall (TPR)    : {metrics['recall']:.4f}  ({metrics['recall']*100:.1f}% of all fraudulent transactions were intercepted)")
    print(f"  - F1-Score        : {metrics['f1_score']:.4f}  (Harmonic mean balancing precision and recall)")
    print(f"  - PR-AUC          : {metrics['pr_auc']:.4f}  (Area Under Precision-Recall Curve across all thresholds)")
    print(f"  - ROC-AUC         : {metrics['roc_auc']:.4f}  (Overall discriminatory ability between classes)")
    print("-" * 78)
    print("Confusion Matrix Breakdown (@ default threshold = 0.5):")
    print(f"  - True Positives  (TP) : {tp:,} fraud attempts successfully blocked.")
    print(f"  - False Negatives (FN) : {fn:,} fraud attempts slipped through undetected.")
    print(f"  - False Positives (FP) : {fp:,} legitimate customers inconvenienced by false alarm.")
    print(f"  - True Negatives  (TN) : {tn:,} legitimate transactions processed friction-free.")
    print("-" * 78)

    print("\nThreshold Trade-Off Profile (0.1 to 0.9):")
    print(f"{'Threshold':<11} | {'Precision':<10} | {'Recall':<8} | {'F1-Score':<8} | {'TP':<6} | {'FP':<6}")
    print("-" * 62)
    for _, row in thresh_df.iterrows():
        print(f"{row['threshold']:<11.1f} | {row['precision']:<10.4f} | {row['recall']:<8.4f} | {row['f1_score']:<8.4f} | {int(row['tp']):<6} | {int(row['fp']):<6}")

    print("\n" + "#" * 78)
    print("CRITICAL NOTE ON METRICS: WHY ACCURACY IS MISLEADING FOR IMBALANCED DATA")
    print("#" * 78)
    print(
        "In fraud detection datasets like PaySim, ~99.87% of all transactions are legitimate.\n"
        "A trivial dummy model that blindly classifies EVERY transaction as 'legitimate' achieves\n"
        "99.87% Accuracy, yet fails to detect a single instance of financial crime (0% recall,\n"
        "100% loss of stolen capital).\n\n"
        "Therefore, accuracy is an actively hazardous metric in fraud prevention. FraudGuard AI\n"
        "evaluates models primarily using PR-AUC (Precision-Recall Area Under the Curve) and\n"
        "Recall to quantify true financial interception capability while measuring customer friction (Precision)."
    )
    print("#" * 78 + "\n")


def evaluate_pipeline(
    raw_path: Optional[Union[str, Path]] = None,
    reports_dir: Union[str, Path] = REPORTS_DIR,
    model_path: Union[str, Path] = MODEL_PATH,
    preprocessor_path: Union[str, Path] = PREPROCESSOR_PATH,
    feature_names_path: Union[str, Path] = FEATURE_NAMES_PATH,
    metrics_path: Union[str, Path] = METRICS_PATH,
) -> Dict[str, Any]:
    """Execute evaluation pipeline and persist all artifacts to reports_dir."""
    rep_dir = Path(reports_dir)
    rep_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load trained artifacts
    model, preprocessor, feature_names = load_artifacts(
        model_path=model_path,
        preprocessor_path=preprocessor_path,
        feature_names_path=feature_names_path,
    )
    model_name = type(model).__name__

    # 2. Load and split test data
    logger.info("Loading test dataset...")
    df = load_data(raw_path=raw_path)
    _, X_test_raw, _, y_test = split_data(df)

    # 3. Transform test partition using fitted preprocessor
    logger.info("Transforming test partition...")
    X_test = preprocessor.transform(X_test_raw)

    # 4. Generate predictions and probabilities
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    # 5. Calculate metrics
    precision = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
    recall = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
    pr_auc = float(average_precision_score(y_test, y_proba))
    roc_auc = float(roc_auc_score(y_test, y_proba))

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    # 6. Save metrics.json with EXACT required schema
    metrics_data = {
        "model_name": model_name,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
        },
        "threshold": 0.5,
        "trained_at": datetime.now().isoformat(),
    }

    out_metrics_file = Path(metrics_path)
    with open(out_metrics_file, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    logger.info("Saved metrics.json to: %s", out_metrics_file.resolve())

    # 7. Generate and save diagnostic visualizations
    plot_confusion_matrix(cm, model_name, rep_dir / "confusion_matrix.png")
    plot_precision_recall_curve(y_test, y_proba, pr_auc, model_name, rep_dir / "precision_recall_curve.png")
    plot_roc_curve(y_test, y_proba, roc_auc, model_name, rep_dir / "roc_curve.png")
    plot_feature_importance(model, feature_names, model_name, rep_dir / "feature_importance.png", top_n=10)

    # 8. Threshold analysis
    thresh_df = perform_threshold_analysis(y_test, y_proba, rep_dir / "threshold_analysis.csv")

    # 9. Print plain-language summary and warning
    print_plain_language_summary(metrics_data, thresh_df, len(y_test))

    return metrics_data


if __name__ == "__main__":
    print("=" * 70)
    print("FraudGuard AI - Model Evaluation & Diagnostic Suite")
    print("=" * 70)

    target_raw = Path(RAW_DATA_PATH)
    demo_file = None

    if not target_raw.exists():
        print(f"\n[Notice] Raw PaySim dataset not found at: {target_raw.resolve()}")
        print("Using synthetic dataset sample to demonstrate evaluation suite...\n")

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

        demo_file = target_raw.parent / "_demo_eval_sample.csv"
        mock_df.to_csv(demo_file, index=False)
        effective_path = demo_file
    else:
        effective_path = target_raw

    try:
        evaluate_pipeline(raw_path=effective_path)
    finally:
        if demo_file and demo_file.exists():
            demo_file.unlink()
