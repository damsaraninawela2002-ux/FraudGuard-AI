"""Data Preprocessing and Pipeline Serialization Module.

FraudGuard AI – Explainable Fraud Detection System

This module handles:
1. Loading and cleaning the PaySim dataset (renaming columns, deriving temporal features,
   and removing high-cardinality/uninformative identifier columns).
2. Performing stratified train/test splitting BEFORE any transformation or resampling
   to prevent data leakage.
3. Constructing and fitting a scikit-learn ColumnTransformer (StandardScaler for continuous
   features, OneHotEncoder for categorical features).
4. Persisting the fitted preprocessor and output feature names.
"""

import json
import logging
from pathlib import Path
import sys
from typing import List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Resolve module paths dynamically to support running as script or import
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
        NUMERIC_FEATURES,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        TARGET,
        TEST_SIZE,
    )
except ImportError:
    from src.config import (
        CATEGORICAL_FEATURES,
        FEATURE_NAMES_PATH,
        NUMERIC_FEATURES,
        PREPROCESSOR_PATH,
        RANDOM_STATE,
        RAW_DATA_PATH,
        TARGET,
        TEST_SIZE,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_data(
    raw_path: Optional[Union[str, Path]] = None,
    sample_legit_ratio: Optional[float] = None,
) -> pd.DataFrame:
    """Load the raw PaySim CSV dataset, clean column names, and derive features.

    Operations performed:
    - Reads the CSV file via pandas.
    - Renames raw columns to standardized snake_case format.
    - Computes `hour_of_day = step % 24` to capture daily cyclical activity.
    - Drops non-generalizing customer identifiers (`nameOrig`, `nameDest`),
      the heuristic business rule flag (`isFlaggedFraud`), and raw linear `step`.
    - Preserves all transaction types existing in the dataset (no silent filtering).
    - Optionally undersamples legitimate transactions for faster experimentation
      while keeping 100% of all fraudulent rows.

    Parameters
    ----------
    raw_path : str or Path, optional
        Path to the CSV dataset. Defaults to RAW_DATA_PATH from config.
    sample_legit_ratio : float, optional
        Undersampling ratio for the majority (legitimate) class:
        - If >= 1.0: Keeps all fraud rows and samples (fraud_count * sample_legit_ratio)
          legitimate rows (e.g., sample_legit_ratio=10 yields a 10:1 legit-to-fraud ratio).
        - If 0 < sample_legit_ratio < 1.0: Samples that fraction of all legitimate rows.
        - If None: Preserves the entire dataset without undersampling.

    Returns
    -------
    pd.DataFrame
        Cleaned transaction dataframe ready for train/test splitting.
    """
    path = Path(raw_path) if raw_path is not None else Path(RAW_DATA_PATH)

    if not path.exists():
        raise FileNotFoundError(
            f"Raw dataset file not found at '{path.resolve()}'. "
            "Please ensure 'PS_20174392719_1491204439457_Log.csv' is placed in ml/data/raw/."
        )

    logger.info("Reading raw dataset from %s...", path)
    df = pd.read_csv(path)

    # 1. Standardize column names to snake_case
    rename_mapping = {
        "type": "transaction_type",
        "oldbalanceOrg": "old_balance_origin",
        "newbalanceOrig": "new_balance_origin",
        "oldbalanceDest": "old_balance_dest",
        "newbalanceDest": "new_balance_dest",
        "isFraud": "is_fraud",
    }
    df = df.rename(columns=rename_mapping)

    # 2. Derive cyclical hour_of_day from simulation step (1 step = 1 hour)
    if "step" in df.columns:
        df["hour_of_day"] = df["step"] % 24

    # 3. Drop uninformative identifiers and raw step
    drop_cols = ["nameOrig", "nameDest", "isFlaggedFraud", "step"]
    df = df.drop(columns=[col for col in drop_cols if col in df.columns])

    # 4. Retain all transaction types present in the dataset (do not drop rows silently)
    existing_types = sorted(df["transaction_type"].dropna().unique().tolist())
    logger.info("Retained all transaction types present in data: %s", existing_types)

    # 5. Optional undersampling of legitimate class for experimentation
    if sample_legit_ratio is not None and TARGET in df.columns:
        fraud_mask = df[TARGET] == 1
        fraud_df = df[fraud_mask]
        legit_df = df[~fraud_mask]

        n_fraud = len(fraud_df)
        n_legit = len(legit_df)

        if sample_legit_ratio >= 1.0:
            target_legit_count = min(int(n_fraud * sample_legit_ratio), n_legit)
        elif 0 < sample_legit_ratio < 1.0:
            target_legit_count = max(1, int(n_legit * sample_legit_ratio))
        else:
            raise ValueError(f"sample_legit_ratio must be positive, got {sample_legit_ratio}")

        logger.info(
            "Undersampling legitimate class: preserving all %s fraud cases and sampling %s legitimate cases (out of %s).",
            f"{n_fraud:,}",
            f"{target_legit_count:,}",
            f"{n_legit:,}",
        )
        legit_sampled = legit_df.sample(n=target_legit_count, random_state=RANDOM_STATE)
        df = pd.concat([fraud_df, legit_sampled], ignore_index=True)
        # Uniformly shuffle rows
        df = df.sample(frac=1.0, random_state=RANDOM_STATE).reset_index(drop=True)

    logger.info("Data loading complete. Final shape: %s", df.shape)
    return df


def split_data(
    df: pd.DataFrame,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
    target_column: str = TARGET,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Perform stratified train/test split.

    CRITICAL ARCHITECTURAL DECISION: Why Splitting MUST Happen First
    -----------------------------------------------------------------
    1. Prevents Data Leakage:
       Preprocessing steps such as standardization (calculating means and standard
       deviations) and categorical encoding must be learned EXCLUSIVELY from the training
       set. If fit on the combined dataset prior to splitting, statistics from the test
       set contaminate the training process, causing overly optimistic metric estimates.
    2. Prevents Target Leakage from Resampling:
       If balancing techniques (e.g. SMOTE, ADASYN, or oversampling) are applied before
       splitting, synthetic points created by interpolating between neighboring samples
       could end up in both training and test partitions. This invalidates the independence
       of the test set and leads to overfitting that degrades in real production.
    3. Reflects Production Reality:
       In production, future transactions arrive one by one and are completely unseen.
       Fitting the preprocessor strictly on the training partition replicates this real-world
       environment.

    Parameters
    ----------
    df : pd.DataFrame
        Cleaned transaction dataframe containing features and target.
    test_size : float
        Fraction of data reserved for testing (default: 0.2).
    random_state : int
        Seed for deterministic split (default: 42).
    target_column : str
        Name of the binary fraud label column ('is_fraud').

    Returns
    -------
    Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]
        (X_train, X_test, y_train, y_test)
    """
    if target_column not in df.columns:
        raise KeyError(f"Target column '{target_column}' is missing from the DataFrame.")

    X = df.drop(columns=[target_column])
    y = df[target_column]

    logger.info(
        "Performing stratified train/test split (test_size=%.2f, random_state=%d)...",
        test_size,
        random_state,
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )

    return X_train, X_test, y_train, y_test


def build_preprocessor(
    numeric_features: Optional[List[str]] = None,
    categorical_features: Optional[List[str]] = None,
    verbose_feature_names_out: bool = False,
) -> ColumnTransformer:
    """Construct a scikit-learn ColumnTransformer for feature transformations.

    Applies:
    - StandardScaler to numeric features.
    - OneHotEncoder(handle_unknown="ignore", sparse_output=False) to categorical features.

    Parameters
    ----------
    numeric_features : list of str, optional
        Numeric continuous columns to scale. Defaults to NUMERIC_FEATURES from config.
    categorical_features : list of str, optional
        Categorical columns to one-hot encode. Defaults to CATEGORICAL_FEATURES from config.
    verbose_feature_names_out : bool, default False
        If False, output feature names remain clean and human-readable without transformer
        prefixes (e.g., 'amount', 'transaction_type_CASH_OUT' instead of 'num__amount').
        This ensures explainability outputs (e.g., SHAP summary plots) remain interpretable.

    Returns
    -------
    ColumnTransformer
        Configured, un-fitted ColumnTransformer.
    """
    num_cols = numeric_features if numeric_features is not None else NUMERIC_FEATURES
    cat_cols = categorical_features if categorical_features is not None else CATEGORICAL_FEATURES

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_cols),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                cat_cols,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=verbose_feature_names_out,
    )
    return preprocessor


def save_preprocessor(
    preprocessor: ColumnTransformer,
    preprocessor_path: Union[str, Path] = PREPROCESSOR_PATH,
    feature_names_path: Union[str, Path] = FEATURE_NAMES_PATH,
) -> List[str]:
    """Persist the fitted ColumnTransformer and its output feature names list.

    Parameters
    ----------
    preprocessor : ColumnTransformer
        Fitted scikit-learn ColumnTransformer instance.
    preprocessor_path : str or Path
        Target file path for the joblib preprocessor artifact.
    feature_names_path : str or Path
        Target file path for the JSON feature names list artifact.

    Returns
    -------
    list of str
        List of transformed feature names.
    """
    prep_p = Path(preprocessor_path)
    feat_p = Path(feature_names_path)

    prep_p.parent.mkdir(parents=True, exist_ok=True)
    feat_p.parent.mkdir(parents=True, exist_ok=True)

    # 1. Save fitted ColumnTransformer with joblib
    joblib.dump(preprocessor, prep_p)
    logger.info("Saved fitted preprocessor to: %s", prep_p.resolve())

    # 2. Extract feature names and save as JSON
    feature_names = list(preprocessor.get_feature_names_out())
    with open(feat_p, "w", encoding="utf-8") as f:
        json.dump(feature_names, f, indent=2)
    logger.info(
        "Saved %d transformed feature names to: %s",
        len(feature_names),
        feat_p.resolve(),
    )

    return feature_names


def load_preprocessor(
    preprocessor_path: Union[str, Path] = PREPROCESSOR_PATH,
) -> ColumnTransformer:
    """Load a previously serialized ColumnTransformer artifact from disk."""
    path = Path(preprocessor_path)
    if not path.exists():
        raise FileNotFoundError(f"Preprocessor artifact not found at: {path.resolve()}")
    return joblib.load(path)


def run_preprocessing_pipeline(
    raw_path: Optional[Union[str, Path]] = None,
    sample_legit_ratio: Optional[float] = None,
    save_artifacts: bool = True,
) -> Tuple[np.ndarray, np.ndarray, pd.Series, pd.Series, ColumnTransformer, List[str]]:
    """Execute the end-to-end preprocessing pipeline.

    1. Loads raw dataset with optional legitimate undersampling.
    2. Performs stratified train/test split on raw features.
    3. Builds and fits the ColumnTransformer on X_train ONLY.
    4. Transforms X_train and X_test.
    5. Persists preprocessor and feature names artifacts.

    Returns
    -------
    Tuple
        (X_train_transformed, X_test_transformed, y_train, y_test, preprocessor, feature_names)
    """
    # 1. Load data
    df = load_data(raw_path=raw_path, sample_legit_ratio=sample_legit_ratio)

    # 2. Split data before any transformations
    X_train, X_test, y_train, y_test = split_data(df)

    # 3. Build ColumnTransformer
    preprocessor = build_preprocessor()

    # 4. Fit preprocessor STRICTLY on X_train to prevent leakage
    logger.info("Fitting ColumnTransformer on training partition ONLY...")
    preprocessor.fit(X_train)

    # 5. Transform both partitions
    X_train_trans = preprocessor.transform(X_train)
    X_test_trans = preprocessor.transform(X_test)

    # 6. Save artifacts
    feature_names: List[str] = []
    if save_artifacts:
        feature_names = save_preprocessor(preprocessor)
    else:
        feature_names = list(preprocessor.get_feature_names_out())

    return X_train_trans, X_test_trans, y_train, y_test, preprocessor, feature_names


if __name__ == "__main__":
    print("=" * 70)
    print("FraudGuard AI - Preprocessing Pipeline Execution")
    print("=" * 70)

    # Check whether the real PaySim raw dataset is present
    target_raw_path = Path(RAW_DATA_PATH)
    demo_mode = False

    if not target_raw_path.exists():
        print(f"\n[Notice] Real dataset not found at: {target_raw_path.resolve()}")
        print("Creating a synthetic PaySim sample to demonstrate pipeline execution...\n")
        demo_mode = True

        np.random.seed(RANDOM_STATE)
        n_samples = 25000
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

        # Inject fraud cases into TRANSFER and CASH_OUT
        fraud_idx = np.random.choice(
            mock_df[mock_df["type"].isin(["TRANSFER", "CASH_OUT"])].index,
            size=int(n_samples * 0.002),
            replace=False,
        )
        mock_df.loc[fraud_idx, "isFraud"] = 1
        mock_df.loc[fraud_idx, "newbalanceOrig"] = 0.0

        demo_csv_path = target_raw_path.parent / "_demo_sample.csv"
        mock_df.to_csv(demo_csv_path, index=False)
        effective_path = demo_csv_path
    else:
        effective_path = target_raw_path

    # Run preprocessing pipeline (using sample_legit_ratio=20 for fast execution if large dataset)
    ratio = 20 if not demo_mode else None
    X_train_t, X_test_t, y_train, y_test, preprocessor, feature_names = run_preprocessing_pipeline(
        raw_path=effective_path,
        sample_legit_ratio=ratio,
        save_artifacts=True,
    )

    print("\n" + "-" * 40)
    print("Dataset Splitting Summary:")
    print("-" * 40)
    print(f"Train Features Shape: {X_train_t.shape}")
    print(f"Test Features Shape:  {X_test_t.shape}")
    print(f"Train Labels Shape:   {y_train.shape}")
    print(f"Test Labels Shape:    {y_test.shape}")

    print("\n" + "-" * 40)
    print("Train Set Class Distribution:")
    print("-" * 40)
    train_counts = y_train.value_counts()
    train_pcts = y_train.value_counts(normalize=True) * 100
    for label, count in train_counts.items():
        desc = "Fraudulent (1)" if label == 1 else "Legitimate (0)"
        print(f"  {desc:<16}: {count:>8,} samples ({train_pcts[label]:.4f}%)")

    print("\n" + "-" * 40)
    print("Test Set Class Distribution:")
    print("-" * 40)
    test_counts = y_test.value_counts()
    test_pcts = y_test.value_counts(normalize=True) * 100
    for label, count in test_counts.items():
        desc = "Fraudulent (1)" if label == 1 else "Legitimate (0)"
        print(f"  {desc:<16}: {count:>8,} samples ({test_pcts[label]:.4f}%)")

    print("\n" + "-" * 40)
    print(f"Transformed Features List ({len(feature_names)} features):")
    print("-" * 40)
    for idx, fname in enumerate(feature_names, 1):
        print(f"  {idx:2d}. {fname}")

    # Clean up demo file if created
    if demo_mode and (target_raw_path.parent / "_demo_sample.csv").exists():
        (target_raw_path.parent / "_demo_sample.csv").unlink()

    print("\n[SUCCESS] Preprocessing completed successfully.")
