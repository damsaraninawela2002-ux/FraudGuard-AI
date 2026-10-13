import { NavLink } from "react-router-dom";
import {
  BarChart3,
  History,
  LayoutDashboard,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Analyze Transaction",
    path: "/analyze",
    icon: ScanSearch,
  },
  {
    name: "Transaction History",
    path: "/history",
    icon: History,
  },
  {
    name: "Model Performance",
    path: "/model-performance",
    icon: BarChart3,
  },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/70 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-navy via-navy-900 to-navy-800 border-r border-white/5 text-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Top Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/15 text-teal border border-teal/25 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                FraudGuard <span className="text-teal font-extrabold">AI</span>
              </span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="px-4 pt-5 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menu
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-r-xl border-l-4 px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "border-teal bg-teal/15 text-white font-semibold shadow-xs"
                      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-105" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer with Status Card */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
              </span>
              <p className="text-xs font-semibold text-white">
                Explainable Fraud Detection
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Detect risky transactions. Understand why.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
