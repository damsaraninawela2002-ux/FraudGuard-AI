import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Hash,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import RiskBadge from "../cards/RiskBadge";
import ShapChart from "../charts/ShapChart";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { getRiskLevel, riskColors } from "../../utils/risk";
import { buildRiskReasons } from "../../utils/riskReasons";

const RECOMMENDATION_PILL_CLASSES = {
  Low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  Medium: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  High: "border-risk-high/30 bg-risk-high/10 text-risk-high",
};

export default function TransactionDetailsModal({ transaction, onClose }) {
  const [copied, setCopied] = useState(false);

  // Close modal when pressing Escape
  useEffect(() => {
    if (!transaction) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transaction, onClose]);

  if (!transaction) return null;

  const txId =
    transaction.transaction_id || transaction._id || transaction.id || "—";
  const riskScore = Number(transaction.risk_score) || 0;
  const isFraud =
    transaction.prediction === "Potential Fraud" || riskScore >= 0.5;
  const verdictLabel = isFraud ? "Potential Fraud" : "Legitimate";
  const resolvedRiskLevel =
    transaction.risk_level || getRiskLevel(riskScore);

  const topFeatures = Array.isArray(transaction.top_features)
    ? transaction.top_features
    : [];
  const reasonsData = buildRiskReasons(
    transaction,
    riskScore,
    resolvedRiskLevel,
    topFeatures
  );

  const isLowRisk = resolvedRiskLevel === "Low";
  const pillClass =
    RECOMMENDATION_PILL_CLASSES[resolvedRiskLevel] ||
    RECOMMENDATION_PILL_CLASSES.Low;

  const riskSection =
    reasonsData.riskReasons.length > 0 ? (
      <div
        key="risk-reasons"
        aria-label={
          isLowRisk
            ? "Minor flags that did not raise the risk level"
            : "Reasons why the transaction looks risky"
        }
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`h-4 w-4 shrink-0 ${
              isLowRisk ? "text-risk-medium" : "text-risk-high"
            }`}
          />
          <h4 className="text-xs sm:text-sm font-semibold text-navy">
            {isLowRisk
              ? "Minor flags (not enough to raise the risk level)"
              : "Why it looks risky"}
          </h4>
        </div>
        <ul className="space-y-2 pl-1 text-xs sm:text-sm text-navy">
          {reasonsData.riskReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isLowRisk
                    ? riskColors.Medium
                    : riskColors.High,
                }}
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const safeSection =
    reasonsData.safeReasons.length > 0 ? (
      <div
        key="safe-reasons"
        aria-label="Signals that look normal"
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-risk-low" />
          <h4 className="text-xs sm:text-sm font-semibold text-navy">
            Signals that look normal
          </h4>
        </div>
        <ul className="space-y-2 pl-1 text-xs sm:text-sm text-navy">
          {reasonsData.safeReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: riskColors.Low }}
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const orderedSections = isLowRisk
    ? [safeSection, riskSection].filter(Boolean)
    : [riskSection, safeSection].filter(Boolean);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(String(txId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-navy/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      {/* Modal Content Panel */}
      <div
        className="relative my-auto w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isFraud
                  ? "bg-risk-high/10 text-risk-high border-risk-high/20"
                  : "bg-risk-low/10 text-risk-low border-risk-low/20"
              }`}
            >
              {isFraud ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="transaction-modal-title"
                className="text-base sm:text-lg font-bold text-navy truncate"
              >
                Transaction Details
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-mono font-semibold text-navy truncate tabular-nums">
                  {txId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  aria-label="Copy transaction ID"
                  className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-navy transition"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-risk-low" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction details modal"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* 1. Verdict & Score Summary Banner */}
          <div
            className={`rounded-2xl border bg-surface p-4 sm:p-5 border-l-4 ${
              isFraud
                ? "border-slate-200 border-l-risk-high"
                : "border-slate-200 border-l-risk-low"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Classification Outcome
                </p>
                <p
                  className={`mt-0.5 text-xl sm:text-2xl font-bold ${
                    isFraud ? "text-risk-high" : "text-risk-low"
                  }`}
                >
                  {verdictLabel}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Raw Fraud Probability:{" "}
                  <span className="font-mono font-semibold text-navy tabular-nums">
                    {(riskScore * 100).toFixed(2)}% ({riskScore.toFixed(4)})
                  </span>
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <RiskBadge level={resolvedRiskLevel} score={riskScore} />
                {transaction.created_at && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDateTime(transaction.created_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Transaction Input Parameters Grid */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Transaction Features &amp; Balances
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Amount</p>
                <p className="mt-1 text-sm sm:text-base font-bold text-navy tabular-nums">
                  {formatCurrency(transaction.amount)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Transaction Type
                </p>
                <p className="mt-1 text-sm sm:text-base font-bold text-navy">
                  {transaction.transaction_type || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Hour of Day
                </p>
                <p className="mt-1 text-sm sm:text-base font-bold text-navy tabular-nums">
                  {transaction.hour_of_day !== undefined
                    ? `${String(transaction.hour_of_day).padStart(2, "0")}:00 (Hour ${transaction.hour_of_day})`
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Origin Balance Before
                </p>
                <p className="mt-1 text-sm font-semibold text-navy tabular-nums">
                  {formatCurrency(transaction.old_balance_origin)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Origin Balance After
                </p>
                <p className="mt-1 text-sm font-semibold text-navy tabular-nums">
                  {formatCurrency(transaction.new_balance_origin)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Destination Balance Before
                </p>
                <p className="mt-1 text-sm font-semibold text-navy tabular-nums">
                  {formatCurrency(transaction.old_balance_dest)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Destination Balance After
                </p>
                <p className="mt-1 text-sm font-semibold text-navy tabular-nums">
                  {formatCurrency(transaction.new_balance_dest)}
                </p>
              </div>
            </div>
          </div>

          {/* 3. SHAP Explainability Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-bold text-navy">
              SHAP Feature Attributions
            </h3>
            <p className="mt-0.5 mb-3 text-xs text-slate-500">
              Top feature drivers computed when this transaction was evaluated
            </p>
            <ShapChart features={topFeatures} inputValues={transaction} />
          </div>

          {/* 4. "Why this result" Section */}
          <section
            aria-label="Why this result explanation"
            className="rounded-2xl border border-slate-200 bg-surface p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal" />
              <h3 className="text-sm font-bold text-navy">
                Why this result
              </h3>
            </div>

            {reasonsData.summary && (
              <p className="text-xs sm:text-sm font-bold text-navy leading-snug">
                {reasonsData.summary}
              </p>
            )}

            {reasonsData.recommendation && (
              <div>
                <span
                  aria-label={`Analyst recommendation: ${reasonsData.recommendation}`}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-2xs ${pillClass}`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Analyst Recommendation: {reasonsData.recommendation}
                  </span>
                </span>
              </div>
            )}

            {orderedSections.length > 0 && (
              <div className="space-y-3.5 pt-1">{orderedSections}</div>
            )}

            {reasonsData.modelNote && (
              <p className="border-t border-slate-200/80 pt-2.5 text-xs text-slate-500">
                <span className="font-semibold text-navy">Model note:</span>{" "}
                {reasonsData.modelNote}
              </p>
            )}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-surface px-5 py-3.5 sm:px-6 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 px-4"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
