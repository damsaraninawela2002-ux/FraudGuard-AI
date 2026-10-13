import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml.src.preprocess import (
    build_preprocessor,
    load_data,
    load_preprocessor,
    save_preprocessor,
    split_data,
)


@pytest.fixture
def sample_raw_df(tmp_path):
    n_samples = 100
    df = pd.DataFrame({
        "step": np.random.randint(1, 100, size=n_samples),
        "type": np.random.choice(["TRANSFER", "CASH_OUT", "PAYMENT"], size=n_samples),
        "amount": np.random.uniform(10, 5000, size=n_samples),
        "nameOrig": [f"C{i}" for i in range(n_samples)],
        "oldbalanceOrg": np.random.uniform(100, 10000, size=n_samples),
        "newbalanceOrig": np.random.uniform(100, 10000, size=n_samples),
        "nameDest": [f"M{i}" for i in range(n_samples)],
        "oldbalanceDest": np.random.uniform(0, 5000, size=n_samples),
        "newbalanceDest": np.random.uniform(0, 5000, size=n_samples),
        "isFraud": [1 if i < 10 else 0 for i in range(n_samples)],
        "isFlaggedFraud": 0,
    })
    csv_file = tmp_path / "test_raw.csv"
    df.to_csv(csv_file, index=False)
    return csv_file


def test_load_data_columns_and_features(sample_raw_df):
    df = load_data(raw_path=sample_raw_df)

    assert "transaction_type" in df.columns
    assert "old_balance_origin" in df.columns
    assert "new_balance_origin" in df.columns
    assert "old_balance_dest" in df.columns
    assert "new_balance_dest" in df.columns
    assert "is_fraud" in df.columns
    assert "hour_of_day" in df.columns

    assert "nameOrig" not in df.columns
    assert "nameDest" not in df.columns
    assert "isFlaggedFraud" not in df.columns
    assert "step" not in df.columns

    assert df["hour_of_day"].between(0, 23).all()


def test_load_data_undersampling(sample_raw_df):
    df = load_data(raw_path=sample_raw_df, sample_legit_ratio=2.0)
    assert len(df) == 30
    assert (df["is_fraud"] == 1).sum() == 10
    assert (df["is_fraud"] == 0).sum() == 20


def test_split_data_stratification(sample_raw_df):
    df = load_data(raw_path=sample_raw_df)
    X_train, X_test, y_train, y_test = split_data(df, test_size=0.2, random_state=42)

    assert len(X_train) == 80
    assert len(X_test) == 20
    assert len(y_train) == 80
    assert len(y_test) == 20

    assert (y_train == 1).sum() == 8
    assert (y_test == 1).sum() == 2


def test_preprocessor_fit_and_save(sample_raw_df, tmp_path):
    df = load_data(raw_path=sample_raw_df)
    X_train, X_test, y_train, y_test = split_data(df, test_size=0.2, random_state=42)

    preprocessor = build_preprocessor()
    preprocessor.fit(X_train)

    X_train_trans = preprocessor.transform(X_train)
    X_test_trans = preprocessor.transform(X_test)

    assert X_train_trans.shape[0] == 80
    assert X_test_trans.shape[0] == 20

    prep_file = tmp_path / "prep.joblib"
    feat_file = tmp_path / "features.json"

    feature_names = save_preprocessor(preprocessor, prep_file, feat_file)
    assert prep_file.exists()
    assert feat_file.exists()
    assert len(feature_names) == X_train_trans.shape[1]

    loaded_prep = load_preprocessor(prep_file)
    X_reloaded_trans = loaded_prep.transform(X_train)
    np.testing.assert_allclose(X_train_trans, X_reloaded_trans)

    with open(feat_file, "r") as f:
        saved_names = json.load(f)
    assert saved_names == feature_names
