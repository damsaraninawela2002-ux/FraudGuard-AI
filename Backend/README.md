# FraudGuard AI – Backend Service (FastAPI)

FastAPI backend providing JWT authentication, real-time **XGBoost** fraud risk inference, **SHAP (`TreeExplainer`)** local feature attributions, and **MongoDB** audit persistence for FraudGuard AI.

---

## ⚙️ Environment Variables (`Backend/.env`)

Copy `.env.example` to `.env` before starting the server:

```powershell
copy .env.example .env
```

| Variable | Default / Example | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string (local or `mongodb+srv://...` Atlas URI). |
| `DB_NAME` | `fraudguard_db` | Target MongoDB database name. |
| `JWT_SECRET_KEY` | `change-me` | Secret key used to sign JWT access tokens (use a strong 32+ char secret in production). |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token expiration lifetime in minutes. |
| `MODEL_PATH` | `../ml/models/fraud_model.joblib` | Path to serialized `XGBClassifier` artifact (resolved cross-platform via `pathlib`). |
| `PREPROCESSOR_PATH` | `../ml/models/preprocessor.joblib` | Path to fitted scikit-learn `ColumnTransformer`. |
| `FEATURE_NAMES_PATH` | `../ml/models/feature_names.json` | Path to JSON list of transformed feature names. |
| `METRICS_PATH` | `../ml/reports/metrics.json` | Path to offline test evaluation metrics JSON. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed frontend origins (no trailing slashes). |

---

## 🚀 Setup & Scripts

### 1. Create Virtual Environment & Install Dependencies
```powershell
cd Backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Development Server
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **Health Checks**: `GET /health` and `GET /health/db`

### 3. Production Start Command (Render / `Procfile`)
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 4. Run Automated Tests
```powershell
pytest -v
```
Tests run against an isolated `fraudguard_test_db` database and automatically fall back to in-memory `mongomock-motor` if a local MongoDB instance is not running.
