from pathlib import Path

# Base ML project directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"

# File paths
RAW_DATA_PATH = RAW_DATA_DIR / "PS_20174392719_1491204439457_Log.csv"
PROCESSED_DATA_PATH = PROCESSED_DATA_DIR / "processed_transactions.parquet"
MODEL_PATH = MODELS_DIR / "fraud_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessor.joblib"
METRICS_PATH = REPORTS_DIR / "metrics.json"
FEATURE_NAMES_PATH = MODELS_DIR / "feature_names.json"

# Model and Split Parameters
RANDOM_STATE = 42
TEST_SIZE = 0.2

# Feature lists
NUMERIC_FEATURES = [
    "amount",
    "hour_of_day",
    "old_balance_origin",
    "new_balance_origin",
    "old_balance_dest",
    "new_balance_dest",
]
CATEGORICAL_FEATURES = ["transaction_type"]
TARGET = "is_fraud"
