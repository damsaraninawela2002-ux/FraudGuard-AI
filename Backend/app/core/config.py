from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
ML_DIR = PROJECT_ROOT / "ml"


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "fraudguard_db"
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    MODEL_PATH: str = str(ML_DIR / "models" / "fraud_model.joblib")
    PREPROCESSOR_PATH: str = str(ML_DIR / "models" / "preprocessor.joblib")
    FEATURE_NAMES_PATH: str = str(ML_DIR / "models" / "feature_names.json")
    METRICS_PATH: str = str(ML_DIR / "reports" / "metrics.json")
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS_ORIGINS parsed as a list of trimmed strings (without trailing slashes)."""
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
