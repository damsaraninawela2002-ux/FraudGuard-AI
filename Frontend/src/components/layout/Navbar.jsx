import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const PAGE_META = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of fraud detection activity & key metrics",
  },
  "/analyze": {
    title: "Analyze Transaction",
    subtitle: "Predict risk score & inspect SHAP drivers",
  },
  "/history": {
    title: "Transaction History",
    subtitle: "Review historical evaluations & audit logs",
  },
  "/model-performance": {
    title: "Model Performance",
    subtitle: "Model benchmarks on held-out test data",
  },
};

export default function Navbar({ onMenuClick = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const meta = PAGE_META[location.pathname] || {
    title: "FraudGuard AI",
    subtitle: "Explainable Fraud Detection System",
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 transition-colors">
      {/* Left: Mobile Menu Button + Page Title + Subtitle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 lg:hidden transition"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-navy tracking-tight leading-tight">
            {meta.title}
          </h1>
          <p className="hidden md:block text-[11px] text-slate-500 leading-tight">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: User Info + Role Badge + Logout Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-teal to-teal-700 text-white font-bold text-xs shadow-xs ring-2 ring-teal-50">
            {user?.full_name ? (
              user.full_name.charAt(0).toUpperCase()
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>

          <div className="hidden sm:block text-right">
            <div className="flex items-center gap-2 justify-end">
              <p className="text-xs sm:text-sm font-semibold text-navy leading-none">
                {user?.full_name || "Analyst"}
              </p>
              {user?.role && (
                <span className="inline-flex items-center rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-teal-700">
                  {user.role}
                </span>
              )}
            </div>
            {user?.email && (
              <p className="mt-1 text-[11px] text-slate-400 leading-none truncate max-w-[180px]">
                {user.email}
              </p>
            )}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-xs hover:bg-red-50 hover:text-risk-high hover:border-risk-high/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-risk-high/30 transition-all duration-150"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
