# FraudGuard AI – Frontend (React + Vite)

Single-page compliance analyst dashboard built with **React 19**, **Vite 8**, **Tailwind CSS 3.4**, **React Router v7**, **Recharts 3**, and **Axios**.

---

## ⚙️ Environment Variables (`frontend/.env`)

Copy `.env.example` to `.env` before starting the development server:

```powershell
copy .env.example .env
```

| Variable | Example | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend (no trailing slash, no `/api` suffix). Set to your Render URL in Vercel. |

---

## 🚀 Setup & Scripts

### 1. Install Dependencies
```powershell
cd frontend
npm install
```

### 2. Available Scripts
| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with HMR at `http://localhost:5173`. |
| `npm run build` | Builds the optimized production bundle into `frontend/dist/`. |
| `npm run preview` | Locally previews the production build from `frontend/dist/`. |
| `npm run lint` | Runs `oxlint` static analysis across `src/`. |

---

## 🧭 Application Routes

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/login` | `src/pages/Login.jsx` | Public | Analyst sign-in form with JWT storage. |
| `/register` | `src/pages/Register.jsx` | Public | New analyst account registration. |
| `/dashboard` | `src/pages/Dashboard.jsx` | Protected | KPI summary cards, risk donut chart, 30-day fraud trend, and recent transactions. |
| `/analyze` | `src/pages/AnalyzeTransaction.jsx` | Protected | Real-time transaction scoring form, preset scenarios, risk gauge, and SHAP bar chart. |
| `/history` | `src/pages/TransactionHistory.jsx` | Protected | Paginated audit table, search/filters, SHAP detail modal, and CSV export. |
| `/model-performance` | `src/pages/ModelPerformance.jsx` | Protected | Held-out test metrics (`PR-AUC`, `ROC-AUC`, `Precision`, `Recall`, `F1`) and confusion matrix. |
