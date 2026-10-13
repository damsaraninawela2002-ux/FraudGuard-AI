import { useEffect, useState } from "react";
import { Calendar, Filter, RotateCcw, Search, X } from "lucide-react";

const RISK_LEVEL_OPTIONS = [
  { value: "", label: "All Risk Levels" },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const PREDICTION_OPTIONS = [
  { value: "", label: "All Predictions" },
  { value: "Potential Fraud", label: "Potential Fraud" },
  { value: "Legitimate", label: "Legitimate" },
];

const TRANSACTION_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "PAYMENT", label: "PAYMENT" },
  { value: "TRANSFER", label: "TRANSFER" },
  { value: "CASH_OUT", label: "CASH_OUT" },
  { value: "CASH_IN", label: "CASH_IN" },
  { value: "DEBIT", label: "DEBIT" },
];

export default function TransactionFilters({
  filters,
  onFilterChange,
  onReset,
}) {
  const [searchInput, setSearchInput] = useState(filters.search || "");

  // Sync local search input when external filters.search changes
  useEffect(() => {
    setSearchInput(filters.search || "");
  }, [filters.search]);

  // Debounce search input by 400 ms
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === (filters.search || "").trim()) {
      return;
    }

    const timer = setTimeout(() => {
      onFilterChange({ search: trimmed });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  const activeFilterCount = [
    filters.search?.trim(),
    filters.riskLevel,
    filters.prediction,
    filters.type,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="card space-y-4">
      {/* Top Row: Search Input + Active Filter Count + Reset Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Debounced Search by Transaction ID */}
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Transaction ID (e.g. TXN_...)"
            aria-label="Search by Transaction ID"
            className="input pl-10 pr-9 py-2 text-xs sm:text-sm font-mono placeholder:font-sans"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                onFilterChange({ search: "" });
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-navy transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Active Filter Badge & Reset Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5 text-teal" />
            <span>Active filters:</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                activeFilterCount > 0
                  ? "bg-teal/15 text-teal-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {activeFilterCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              onReset();
            }}
            disabled={activeFilterCount === 0}
            aria-label="Reset all filters"
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Reset filters</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Dropdowns & Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
        {/* Risk Level */}
        <div>
          <label
            htmlFor="filter-risk-level"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1"
          >
            Risk Level
          </label>
          <select
            id="filter-risk-level"
            value={filters.riskLevel || ""}
            onChange={(e) => onFilterChange({ riskLevel: e.target.value })}
            className="input py-2 text-xs sm:text-sm"
          >
            {RISK_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Prediction */}
        <div>
          <label
            htmlFor="filter-prediction"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1"
          >
            Prediction
          </label>
          <select
            id="filter-prediction"
            value={filters.prediction || ""}
            onChange={(e) => onFilterChange({ prediction: e.target.value })}
            className="input py-2 text-xs sm:text-sm"
          >
            {PREDICTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Transaction Type */}
        <div>
          <label
            htmlFor="filter-type"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1"
          >
            Transaction Type
          </label>
          <select
            id="filter-type"
            value={filters.type || ""}
            onChange={(e) => onFilterChange({ type: e.target.value })}
            className="input py-2 text-xs sm:text-sm"
          >
            {TRANSACTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label
            htmlFor="filter-date-from"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1"
          >
            From Date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom || ""}
              max={filters.dateTo || undefined}
              onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
              className="input pl-9 py-2 text-xs sm:text-sm tabular-nums"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label
            htmlFor="filter-date-to"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1"
          >
            To Date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo || ""}
              min={filters.dateFrom || undefined}
              onChange={(e) => onFilterChange({ dateTo: e.target.value })}
              className="input pl-9 py-2 text-xs sm:text-sm tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
