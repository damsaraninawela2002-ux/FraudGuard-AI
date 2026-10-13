import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { handleApiError } from "../utils/handleApiError";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect immediately if already authenticated
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateForm = () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return false;
    }
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return false;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!password) {
      setError("Please enter a password.");
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err?.response?.status === 409) {
        setError(
          handleApiError(
            err,
            "An account with this email address is already registered."
          )
        );
      } else {
        setError(
          handleApiError(err, "Unable to create account. Please try again.")
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(20,184,166,0.06),rgba(248,250,252,0))] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row shadow-xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {/* Left Column: Desktop Navy Gradient Brand Showcase Panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy via-navy-900 to-navy-800 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Decorative Glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-teal/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-teal/15 rounded-full blur-3xl pointer-events-none" />

          {/* Brand Header */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/15 text-teal border border-teal/30 shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">
                FraudGuard <span className="text-teal font-extrabold">AI</span>
              </span>
              <p className="text-[11px] text-slate-400">Compliance &amp; Analyst Platform</p>
            </div>
          </div>

          {/* Central Tagline & 3 Feature Bullets */}
          <div className="relative z-10 my-8 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 border border-teal/30 px-3 py-1 text-xs font-semibold text-teal mb-3">
                Fintech Risk Engine
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                Detect risky transactions.<br />Understand why.
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Empower your fraud review teams with instant machine learning predictions and deep interpretability.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal border border-white/10">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Real-time risk scoring</p>
                  <p className="text-[11px] text-slate-400">Calibrated probabilities in milliseconds</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal border border-white/10">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Explainable with SHAP</p>
                  <p className="text-[11px] text-slate-400">Exact feature attribution per transaction</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal border border-white/10">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Analyst-ready workflow</p>
                  <p className="text-[11px] text-slate-400">Interactive sandbox, audit logs &amp; CSV export</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Panel Note */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Production ML pipeline</span>
            <span className="font-mono text-teal">v1.0.0</span>
          </div>
        </div>

        {/* Mobile Header Banner (Visible only on < lg) */}
        <div className="lg:hidden bg-gradient-to-r from-navy via-navy-900 to-navy-800 p-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal/15 text-teal border border-teal/25 mb-3 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            FraudGuard <span className="text-teal">AI</span>
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Detect risky transactions. Understand why.
          </p>
        </div>

        {/* Right Column: Register Form Panel */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
          <div className="mb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-navy tracking-tight">
              Create Analyst Account
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Register as a compliance analyst to monitor transactions.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-risk-high/10 border border-risk-high/30 px-3.5 py-3 text-sm text-risk-high"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* Full Name Input */}
            <div>
              <label htmlFor="full_name" className="label">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Jane Doe"
                disabled={submitting}
                className={`input ${error ? "input-error" : ""}`}
              />
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="analyst@fraudguard.internal"
                disabled={submitting}
                className={`input ${error ? "input-error" : ""}`}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Minimum 8 characters"
                  disabled={submitting}
                  className={`input pr-10 ${error ? "input-error" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-navy transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirm_password" className="label">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Re-enter your password"
                  disabled={submitting}
                  className={`input pr-10 ${error ? "input-error" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-navy transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </div>
          </form>

          {/* Footer Link */}
          <p className="mt-5 text-center text-xs sm:text-sm text-slate-500">
            Already registered?{" "}
            <Link
              to="/login"
              className="font-semibold text-teal hover:underline focus:outline-none"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
