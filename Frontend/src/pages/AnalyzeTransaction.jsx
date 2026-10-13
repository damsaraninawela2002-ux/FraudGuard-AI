import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Hash,
  Info,
  ScanSearch,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { predictTransaction } from "../api/predictApi";
import TransactionForm from "../components/forms/TransactionForm";
import WhatIfSandbox from "../components/sandbox/WhatIfSandbox";
import RiskBadge from "../components/cards/RiskBadge";
import ChartCard from "../components/charts/ChartCard";
import RiskGauge from "../components/charts/RiskGauge";
import ShapChart from "../components/charts/ShapChart";
import { formatDateTime } from "../utils/format";
import { handleApiError } from "../utils/handleApiError";
import { getRiskLevel, riskColors } from "../utils/risk";
import { buildRiskReasons } from "../utils/riskReasons";

const RECOMMENDATION_PILL_CLASSES = {
  Low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  Medium: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  High: "border-risk-high/30 bg-risk-high/10 text-risk-high",
};

export default function AnalyzeTransaction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab =
    searchParams.get("tab") === "sandbox" ? "sandbox" : "analyze";

  const [result, setResult] = useState(null);
  const [lastSubmittedInput, setLastSubmittedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resultsRef = useRef(null);

  const handleSelectTab = (tab) => {
    if (tab === "sandbox") {
      setSearchParams({ tab: "sandbox" });
    } else {
      setSearchParams({});
    }
  };

  const handleAnalyze = async (payload) => {
    setLoading(true);
    setError("");
    setLastSubmittedInput(payload);

    try {
      const predictionData = await predictTransaction(payload);
      setResult(predictionData);

      // Scroll results into view on mobile screens (< 1024px)
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    } catch (err) {
      setError(
        handleApiError(
          err,
          "Failed to analyze transaction. Please check your inputs and try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const riskScore = Number(result?.risk_score) || 0;
  const isFraudVerdict =
    riskScore >= 0.5 || result?.prediction === "Potential Fraud";
  const verdictLabel = isFraudVerdict ? "Potential Fraud" : "Legitimate";
  const resolvedRiskLevel = result?.risk_level || getRiskLevel(riskScore);

  const reasonsData = result
    ? buildRiskReasons(
        lastSubmittedInput || {},
        riskScore,
        resolvedRiskLevel,
        result.top_features || []
      )
    : null;

  const isLowRisk = resolvedRiskLevel === "Low";
  const pillClass =
    RECOMMENDATION_PILL_CLASSES[resolvedRiskLevel] ||
    RECOMMENDATION_PILL_CLASSES.Low;

  const riskSection =
    reasonsData && reasonsData.riskReasons.length > 0 ? (
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
          <h3 className="text-xs sm:text-sm font-semibold text-navy">
            {isLowRisk
              ? "Minor flags (not enough to raise the risk level)"
              : "Why it looks risky"}
          </h3>
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
    reasonsData && reasonsData.safeReasons.length > 0 ? (
      <div
        key="safe-reasons"
        aria-label="Signals that look normal"
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-risk-low" />
          <h3 className="text-xs sm:text-sm font-semibold text-navy">
            Signals that look normal
          </h3>
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

  return (
    <div className="space-y-6">
      {/* Page Header & Segmented Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {activeTab === "sandbox"
              ? "What-If Sandbox"
              : "Analyze Transaction"}
          </h1>
          <p className="page-subtitle">
            {activeTab === "sandbox"
              ? "Adjust hypothetical transaction parameters with sliders and watch the model respond live without saving to MongoDB."
              : "Enter transaction details to get a calibrated fraud risk score and SHAP feature explanation."}
          </p>
        </div>

        {/* 2-Tab Switcher styled as a Segmented Control */}
        <div
          role="tablist"
          aria-label="Analysis mode"
          className="inline-flex self-start sm:self-auto rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analyze"}
            onClick={() => handleSelectTab("analyze")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "analyze"
                ? "bg-navy text-white shadow-xs"
                : "text-slate-600 hover:text-navy hover:bg-white/60"
            }`}
          >
            <ScanSearch className="h-4 w-4 shrink-0" />
            <span>Analyze</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sandbox"}
            onClick={() => handleSelectTab("sandbox")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "sandbox"
                ? "bg-navy text-white shadow-xs"
                : "text-slate-600 hover:text-navy hover:bg-white/60"
            }`}
          >
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span>What-If Sandbox</span>
          </button>
        </div>
      </div>

      {activeTab === "sandbox" ? (
        <WhatIfSandbox />
      ) : (
        /* Main Two-Column Grid (5/12 Form on left, 7/12 Results on right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
          {/* Left Column: Transaction Form (~5/12) */}
          <div className="lg:col-span-5">
            <TransactionForm onSubmit={handleAnalyze} loading={loading} />
          </div>

          {/* Right Column: Results Panel (~7/12) */}
          <div ref={resultsRef} className="lg:col-span-7 space-y-4 md:space-y-6">
            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-risk-high/30 bg-risk-high/10 px-4 py-3.5 text-sm text-risk-high shadow-xs"
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Loading Skeletons */}
            {loading ? (
              <div className="space-y-4 md:space-y-6 animate-pulse">
                {/* Verdict Skeleton */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="h-3.5 w-28 rounded-md bg-slate-200" />
                      <div className="h-8 w-48 rounded-md bg-slate-200" />
                      <div className="h-3.5 w-40 rounded-md bg-slate-100" />
                    </div>
                    <div className="h-8 w-28 rounded-full bg-slate-200" />
                  </div>
                </div>

                {/* Gauge Skeleton */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-5 w-40 rounded-md bg-slate-200 mb-4" />
                  <div className="mx-auto h-40 w-64 rounded-t-full bg-slate-100" />
                </div>

                {/* SHAP Chart Skeleton */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-5 w-48 rounded-md bg-slate-200 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-4 w-32 rounded-md bg-slate-200" />
                        <div className="h-5 flex-1 rounded-md bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !result ? (
              /* Empty State Before First Analysis */
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal mb-4 border border-teal-100">
                  <ScanSearch className="h-7 w-7" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-navy">
                  Run an analysis to inspect predictions
                </h2>
                <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-500">
                  Fill in the transaction parameters on the left or click one of
                  the preset buttons, then click{" "}
                  <span className="font-semibold text-navy">Analyze</span> to
                  generate a calibrated risk score and SHAP feature explanation.
                </p>
              </div>
            ) : (
              /* Results Content */
              <div className="space-y-4 md:space-y-6">
                {/* a) Verdict Card */}
                <div
                  className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm border-l-4 ${
                    isFraudVerdict
                      ? "border-slate-200 border-l-risk-high"
                      : "border-slate-200 border-l-risk-low"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                          isFraudVerdict
                            ? "bg-risk-high/10 text-risk-high border-risk-high/20"
                            : "bg-risk-low/10 text-risk-low border-risk-low/20"
                        }`}
                      >
                        {isFraudVerdict ? (
                          <ShieldAlert className="h-6 w-6" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Model Verdict
                        </p>
                        <h2
                          className={`mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight ${
                            isFraudVerdict ? "text-risk-high" : "text-risk-low"
                          }`}
                        >
                          {verdictLabel}
                        </h2>
                        {result.prediction &&
                          result.prediction !== verdictLabel && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Classification: {result.prediction}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                      <RiskBadge level={resolvedRiskLevel} score={riskScore} />
                      {reasonsData?.recommendation && (
                        <span className="text-xs font-medium text-slate-600">
                          {reasonsData.recommendation}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Footer (Transaction ID & Timestamp) */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
                    {result.transaction_id && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        <span>Transaction ID:</span>
                        <span className="font-mono font-semibold text-navy tabular-nums">
                          {result.transaction_id}
                        </span>
                      </div>
                    )}
                    {result.created_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Evaluated:</span>
                        <span className="font-medium text-navy tabular-nums">
                          {formatDateTime(result.created_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* b) RiskGauge Card */}
                <ChartCard
                  title="Fraud Risk Gauge"
                  subtitle="Calibrated probability of fraudulent activity (0% – 100%)"
                >
                  <RiskGauge score={riskScore} riskLevel={resolvedRiskLevel} />
                </ChartCard>

                {/* c) SHAP Explanation Chart */}
                <ChartCard
                  title="SHAP Feature Attributions"
                  subtitle="Top features ranked by absolute Shapley impact on the prediction"
                >
                  <ShapChart
                    features={result.top_features || []}
                    inputValues={lastSubmittedInput || {}}
                  />
                </ChartCard>

                {/* d) "Why this result" Section */}
                <section
                  aria-label="Why this result explanation"
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-teal" />
                    <h2 className="text-base sm:text-lg font-bold text-navy tracking-tight">
                      Why this result
                    </h2>
                  </div>

                  {/* One-sentence summary at the top (bold) */}
                  {reasonsData?.summary && (
                    <p className="text-sm sm:text-base font-bold text-navy leading-snug">
                      {reasonsData.summary}
                    </p>
                  )}

                  {/* Analyst Recommendation Pill coloured by risk level */}
                  {reasonsData?.recommendation && (
                    <div>
                      <span
                        aria-label={`Analyst recommendation: ${reasonsData.recommendation}`}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-semibold shadow-2xs ${pillClass}`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span>
                          Analyst Recommendation: {reasonsData.recommendation}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Ordered Fact Sections */}
                  {orderedSections.length > 0 ? (
                    <div className="space-y-4 pt-1">{orderedSections}</div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No additional risk or normal signals identified for this
                      transaction.
                    </p>
                  )}

                  {/* Small Model Note */}
                  {reasonsData?.modelNote && (
                    <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="font-semibold text-navy">Model note:</span>{" "}
                      {reasonsData.modelNote}
                    </p>
                  )}
                </section>

                {/* Risk Levels Footnote */}
                <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 py-1">
                  <Info className="h-3.5 w-3.5 text-teal shrink-0" />
                  <span>
                    Risk tiers: Low &lt; 0.30, Medium 0.30 to 0.70, High &gt;
                    0.70
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
