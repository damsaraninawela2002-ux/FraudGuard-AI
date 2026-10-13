# FraudGuard AI – Cloud Deployment Guide

This guide walks through deploying **FraudGuard AI** to production using:
1. **MongoDB Atlas** (Cloud Database)
2. **Render** (FastAPI + XGBoost/SHAP Backend)
3. **Vercel** (React + Vite Frontend)

---

## 1. MongoDB Atlas Setup

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a **Free Shared Cluster (M0)**.
2. **Create a Database User**:
   - Navigate to **Security → Database Access → Add New Database User**.
   - Authentication Method: **Password**.
   - Set a username (e.g., `fraudguard_user`) and a strong alphanumeric password (avoid special characters like `@`, `:`, `/` or URL-encode them).
   - Built-in Role: **Read and write to any database**.
3. **Configure Network Access (IP Allow List)**:
   - Navigate to **Security → Network Access → Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) so Render's dynamic outbound IPs can connect, then click **Confirm**.
4. **Copy the Connection URI**:
   - Navigate to **Deployment → Database → Connect → Drivers** (Python / 3.6 or later).
   - Copy the SRV connection string:
     ```text
     mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.

---

## 2. Deploy Backend on Render

Make sure your repository is pushed to GitHub (including the lightweight `ml/models/*.joblib` and `ml/reports/metrics.json` files).

1. Sign in to [Render](https://render.com/) and click **New + → Web Service**.
2. Connect your GitHub repository (`fraudguard-ai`).
3. Configure the Web Service settings:
   - **Name**: `fraudguard-ai-backend`
   - **Region**: Choose the region closest to your MongoDB Atlas cluster
   - **Root Directory**: `Backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
4. **Add Environment Variables** (under **Environment**):

   | Key | Value |
   |---|---|
   | `PYTHON_VERSION` | `3.11.9` |
   | `MONGODB_URI` | `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority` |
   | `DB_NAME` | `fraudguard_db` |
   | `JWT_SECRET_KEY` | `<generate-a-long-random-hex-secret-at-least-32-chars>` |
   | `JWT_ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
   | `MODEL_PATH` | `../ml/models/fraud_model.joblib` |
   | `PREPROCESSOR_PATH` | `../ml/models/preprocessor.joblib` |
   | `FEATURE_NAMES_PATH` | `../ml/models/feature_names.json` |
   | `METRICS_PATH` | `../ml/reports/metrics.json` |
   | `CORS_ORIGINS` | `http://localhost:5173` *(update with Vercel URL in Step 4)* |

5. Click **Create Web Service** and wait for the build to finish.
6. Copy your live Render URL (e.g., `https://fraudguard-ai-backend.onrender.com`).

---

## 3. Deploy Frontend on Vercel

1. Sign in to [Vercel](https://vercel.com/) and click **Add New... → Project**.
2. Import your GitHub repository (`fraudguard-ai`).
3. Configure the build settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(Click "Edit" next to Root Directory and select `frontend`)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Add Environment Variable**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://fraudguard-ai-backend.onrender.com` *(your Render URL from Step 2 — **no trailing slash** and **no `/api` suffix**)*
5. Click **Deploy**.
6. Note that `frontend/vercel.json` is already included in the repo, so client-side React Router paths (`/login`, `/dashboard`, `/analyze`, `/history`, `/model-performance`) will work on browser refresh.
7. Copy your live Vercel URL (e.g., `https://fraudguard-ai.vercel.app`).

---

## 4. Update Backend CORS with Your Vercel URL

1. Go back to your **Render Dashboard → `fraudguard-ai-backend` → Environment**.
2. Update the `CORS_ORIGINS` environment variable to include your production Vercel URL (comma-separated, no trailing slashes):
   ```text
   https://fraudguard-ai.vercel.app,http://localhost:5173
   ```
3. Save changes. Render will automatically restart the service with the new CORS allowlist.

---

## 5. Production Smoke Test Checklist

Run through these checks in order to confirm the full deployment is healthy:

- [ ] **1. Backend Health & Model Mode (`GET /health`)**  
  Open `https://<your-render-url>/health` in a browser. Confirm it returns:
  ```json
  {"status": "ok", "is_demo": false}
  ```
  *(If `is_demo` is `true`, verify that `ml/models/fraud_model.joblib` and `preprocessor.joblib` are committed to GitHub).*
- [ ] **2. Database Connectivity (`GET /health/db`)**  
  Open `https://<your-render-url>/health/db`. Confirm it returns:
  ```json
  {"status": "ok", "database": "connected"}
  ```
- [ ] **3. User Registration (`/register`)**  
  Open your Vercel URL (`https://<your-vercel-url>/register`) and create a new analyst account. Confirm it redirects to `/login`.
- [ ] **4. User Login (`/login`)**  
  Sign in with your new account. Confirm you land on `/dashboard` and your name appears in the top navbar.
- [ ] **5. Analyze Transaction (`/analyze`)**  
  Click the **High-Risk Transfer** preset and submit **Analyze Transaction**. Confirm you receive a High Risk score, a recommendation banner, and a 5-feature SHAP bar chart.
- [ ] **6. Transaction History & CSV Export (`/history`)**  
  Navigate to **Transaction History**, confirm your analyzed transaction appears in the table, click **View** to inspect the SHAP modal, and click **Export CSV** to verify `transactions_report.csv` downloads.
- [ ] **7. Model Performance (`/model-performance`)**  
  Navigate to **Model Performance** and confirm the held-out test metrics (`PR-AUC: 82.46%`, `ROC-AUC: 99.63%`, `Precision: 88.00%`, `Recall: 73.33%`, `F1: 80.00%`) and Confusion Matrix render properly.

---

## 6. Common Problems & Troubleshooting

### ❌ Issue 1: CORS Error in Browser Console (`No 'Access-Control-Allow-Origin' header`)
- **Cause**: The frontend Vercel domain is missing from `CORS_ORIGINS` on Render, or `CORS_ORIGINS` has a trailing slash (`https://fraudguard-ai.vercel.app/`).
- **Fix**: Ensure `CORS_ORIGINS` on Render exactly matches the browser origin without a trailing slash (`https://fraudguard-ai.vercel.app,http://localhost:5173`). Note that if you test a Vercel preview deployment URL (`https://fraudguard-ai-git-main-...vercel.app`), add that preview URL to `CORS_ORIGINS` as well.

### ⏳ Issue 2: Slow First Request / "Unable to reach the server" on Initial Load (Cold Start)
- **Cause**: Render's Free Tier spins down web services after 15 minutes of inactivity. Waking up the container and loading `XGBoost` + `SHAP` takes ~30–50 seconds on the first request.
- **Fix**: Visit `https://<your-render-url>/health` once to wake the container before logging in, or wait ~30 seconds and click **Sign In** again.

### 🔌 Issue 3: `GET /health/db` Returns `503 Service Unavailable`
- **Cause**:
  1. MongoDB Atlas Network Access does not allow Render's outbound IP (`0.0.0.0/0` missing).
  2. Special characters in the database password inside `MONGODB_URI` are not URL-encoded.
  3. `dnspython` is missing when using `mongodb+srv://` (already included in `Backend/requirements.txt`).
- **Fix**: Add `0.0.0.0/0` in MongoDB Atlas **Network Access**, verify username/password in **Database Access**, and check Render logs for exact connection errors.
