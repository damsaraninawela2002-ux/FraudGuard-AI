import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  FileSearch,
  History,
  RotateCcw,
  ScanSearch,
} from "lucide-react";
import RiskBadge from "../cards/RiskBadge";
import { formatCurrency, formatDateTime, shortId } from "../../utils/format";

function SortableHeader({ label, field, sortBy, sortOrder, onSort }) {
  const isActive = sortBy === field;

  const handleClick = () => {
    if (!onSort) return;
    if (isActive) {
      onSort(field, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSort(field, "desc");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-navy focus:outline-none cursor-pointer"
    >
      <span>{label}</span>
      {isActive ? (
        sortOrder === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 text-teal" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-teal" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      )}
    </button>
  );
}

export default function TransactionsTable({
  items = [],
  loading = false,
  hasActiveFilters = false,
  sortBy = "created_at",
  sortOrder = "desc",
  onSort,
  onSelectTransaction,
  onResetFilters,
}) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyId = async (e, id) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1600);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  // 1. Loading Skeleton Rows
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead className="table-head">
            <tr>
              <th className="py-3.5 pl-6 pr-3">Transaction ID</th>
              <th className="py-3.5 px-3">Date / Time</th>
              <th className="py-3.5 px-3">Type</th>
              <th className="py-3.5 px-3">Amount</th>
              <th className="py-3.5 px-3">Risk</th>
              <th className="py-3.5 pl-3 pr-6">Prediction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white animate-pulse">
            {Array.from({ length: 10 }).map((_, idx) => (
              <tr key={idx}>
                <td className="py-3.5 pl-6 pr-3">
                  <div className="h-4 w-28 rounded-md bg-slate-200" />
                </td>
                <td className="py-3.5 px-3">
                  <div className="h-4 w-36 rounded-md bg-slate-100" />
                </td>
                <td className="py-3.5 px-3">
                  <div className="h-5 w-20 rounded-md bg-slate-100" />
                </td>
                <td className="py-3.5 px-3">
                  <div className="h-4 w-24 rounded-md bg-slate-200" />
                </td>
                <td className="py-3.5 px-3">
                  <div className="h-5 w-24 rounded-full bg-slate-100" />
                </td>
                <td className="py-3.5 pl-3 pr-6">
                  <div className="h-5 w-28 rounded-full bg-slate-200" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 2. Empty States
  if (!items || items.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileSearch className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-navy">
            No transactions match your filters
          </h3>
          <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500">
            Try adjusting your search query, risk tier, or date range filters.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 btn-primary text-xs py-2 px-4"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset filters</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal border border-teal-100">
          <History className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-navy">
          No transactions analyzed yet
        </h3>
        <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500">
          Every transaction you evaluate is automatically recorded here with its full
          SHAP explainability vector.
        </p>
        <Link
          to="/analyze"
          className="mt-4 btn-primary text-xs py-2 px-4"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          <span>Analyze Transaction</span>
        </Link>
      </div>
    );
  }

  // 3. Data Table
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="table-head">
          <tr>
            <th className="py-3.5 pl-6 pr-3">Transaction ID</th>
            <th className="py-3.5 px-3">
              <SortableHeader
                label="Date / Time"
                field="created_at"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="py-3.5 px-3">Type</th>
            <th className="py-3.5 px-3">
              <SortableHeader
                label="Amount"
                field="amount"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="py-3.5 px-3">
              <SortableHeader
                label="Risk"
                field="risk_score"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="py-3.5 pl-3 pr-6">Prediction</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white text-xs sm:text-sm">
          {items.map((tx, idx) => {
            const txId = tx.transaction_id || tx._id || tx.id;
            const isFraud =
              tx.prediction === "Potential Fraud" ||
              Number(tx.risk_score) >= 0.5;
            const predictionText = isFraud ? "Potential Fraud" : "Legitimate";
            const isCopied = copiedId === txId;

            return (
              <tr
                key={txId || idx}
                onClick={() => {
                  if (onSelectTransaction) onSelectTransaction(tx);
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (onSelectTransaction) onSelectTransaction(tx);
                  }
                }}
                className={`table-row cursor-pointer ${
                  idx % 2 === 1 ? "bg-surface/50" : "bg-white"
                }`}
              >
                {/* Transaction ID + Copy Button */}
                <td className="py-3.5 pl-6 pr-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      className="font-mono text-xs font-semibold text-navy tabular-nums"
                      title={txId}
                    >
                      {shortId(txId)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(e, txId)}
                      aria-label={`Copy transaction ID ${txId}`}
                      title="Copy full Transaction ID"
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 transition"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-risk-low" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </td>

                {/* Date / Time */}
                <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                  {formatDateTime(tx.created_at)}
                </td>

                {/* Type */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-navy">
                    {tx.transaction_type}
                  </span>
                </td>

                {/* Amount */}
                <td className="py-3.5 px-3 font-semibold text-navy whitespace-nowrap tabular-nums">
                  {formatCurrency(tx.amount)}
                </td>

                {/* Risk Badge with Score */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <RiskBadge
                    level={tx.risk_level}
                    score={tx.risk_score}
                  />
                </td>

                {/* Prediction Pill */}
                <td className="py-3.5 pl-3 pr-6 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs ${
                      isFraud
                        ? "border-risk-high/30 bg-risk-high/10 text-risk-high"
                        : "border-risk-low/30 bg-risk-low/10 text-risk-low"
                    }`}
                  >
                    {predictionText}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
