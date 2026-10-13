import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AnalyzeTransaction from "./pages/AnalyzeTransaction";
import TransactionHistory from "./pages/TransactionHistory";
import ModelPerformance from "./pages/ModelPerformance";

function NotFound() {
  return (
    <div className="min-h-screen bg-surface bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(20,184,166,0.06),rgba(248,250,252,0))] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-extrabold text-teal">404</p>
      <h1 className="mt-3 page-title">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 btn-primary"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected Routes wrapped in AppLayout (Sidebar + Navbar) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analyze" element={<AnalyzeTransaction />} />
              <Route path="/history" element={<TransactionHistory />} />
              <Route path="/model-performance" element={<ModelPerformance />} />
            </Route>
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
