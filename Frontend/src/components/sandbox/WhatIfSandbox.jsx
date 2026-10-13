import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { predictTransaction, simulateTransaction } from "../../api/predictApi";
import RiskBadge from "../cards/RiskBadge";
import ChartCard from "../charts/ChartCard";
import RiskGauge from "../charts/RiskGauge";
import ShapChart from "../charts/ShapChart";
import { CURRENCY_SYMBOL, formatCurrency } from "../../utils/format";
import { handleApiError } from "../../utils/handleApiError";
import { getRiskLevel, riskColors } from "../../utils/risk";
import { buildRiskReasons } from "../../utils/riskReasons";

const TRANSACTION_TYPES = [
  "PAYMENT",
  "TRANSFER",
  "CASH_OUT",
  "CASH_IN",
  "DEBIT",
];

const MAX_SLIDER_VALUE = 1000000;

const LEGIT_PAYMENT_PRESET = {
  transaction_type: "PAYMENT",
  amount: 250,
  old_balance_origin: 5000,
  new_balance_origin: 4750,
  old_balance_dest: 0,
  new_balance_dest: 0,
  hour_of_day: 14,
};

const FRAUD_TRANSFER_PRESET = {
  transaction_type: "TRANSFER",
  amount: 900000,
  old_balance_origin: 900000,
  new_balance_origin: 0,
  old_balance_dest: 0,
  new_balance_dest: 0,
  hour_of_day: 3,
};

const RECOMMENDATION_PILL_CLASSES = {
  Low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  Medium: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  High: "border-risk-high/30 bg-risk-high/10 text-risk-high",
};

const LEVEL_BADGE_TEXT_CLASSES = {
  Low: "text-risk-low bg-risk-low/10 border-risk-low/30",
  Medium: "text-risk-medium bg-risk-medium/10 border-risk-medium/30",
  High: "text-risk-high bg-risk-high/10 border-risk-high/30",
};

function formatHourLabel(hour) {
  const h = Math.max(0, Math.min(23, Math.round(Number(hour) || 0)));
  return `${String(h).padStart(2, "0")}:00`;
}

function clampNonNegative(val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

export default function WhatIfSandbox() {
  const [inputs, setInputs] = useState(LEGIT_PAYMENT_PRESET);
  const [autoCalculate, setAutoCalculate] = useState(true);

  const [currentResult, setCurrentResult] = useState(null);
  const [previousResult, setPreviousResult] = useState(null);
  const [evaluatedInputs, setEvaluatedInputs] = useState(LEGIT_PAYMENT_PRESET);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  // State for "Save this as a real analysis"
  const [saving, setSaving] = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [saveError, setSaveError] = useState("");

  // Monotonic request counter + AbortController ref to ignore stale responses
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const latestResultRef = useRef(null);
  const isFirstRunRef = useRef(true);

  const clearSavedBanner = () => {
    if (savedRecord) setSavedRecord(null);
    if (saveError) setSaveError("");
  };

  const handleTypeChange = (type) => {
    clearSavedBanner();
    setInputs((prev) => ({
      ...prev,
      transaction_type: type,
    }));
  };

  const handleHourChange = (rawHour) => {
    clearSavedBanner();
    const hour = Math.max(0, Math.min(23, Math.round(Number(rawHour) || 0)));
    setInputs((prev) => ({
      ...prev,
      hour_of_day: hour,
    }));
  };

  const handleAmountChange = (rawAmount) => {
    clearSavedBanner();
    const amount = clampNonNegative(rawAmount);
    setInputs((prev) => {
      if (!autoCalculate) {
        return { ...prev, amount };
      }
      return {
        ...prev,
        amount,
        new_balance_origin: Math.max(0, prev.old_balance_origin - amount),
        new_balance_dest: prev.old_balance_dest + amount,
      };
    });
  };

  const handleOldOriginChange = (rawVal) => {
    clearSavedBanner();
    const old_balance_origin = clampNonNegative(rawVal);
    setInputs((prev) => {
      if (!autoCalculate) {
        return { ...prev, old_balance_origin };
      }
      return {
        ...prev,
        old_balance_origin,
        new_balance_origin: Math.max(0, old_balance_origin - prev.amount),
      };
    });
  };

  const handleNewOriginChange = (rawVal) => {
    clearSavedBanner();
    const new_balance_origin = clampNonNegative(rawVal);
    setInputs((prev) => ({
      ...prev,
      new_balance_origin,
    }));
  };

  const handleOldDestChange = (rawVal) => {
    clearSavedBanner();
    const old_balance_dest = clampNonNegative(rawVal);
    setInputs((prev) => {
      if (!autoCalculate) {
        return { ...prev, old_balance_dest };
      }
      return {
        ...prev,
        old_balance_dest,
        new_balance_dest: old_balance_dest + prev.amount,
      };
    });
  };

  const handleNewDestChange = (rawVal) => {
    clearSavedBanner();
    const new_balance_dest = clampNonNegative(rawVal);
    setInputs((prev) => ({
      ...prev,
      new_balance_dest,
    }));
  };

  const handleToggleAutoCalculate = (checked) => {
    clearSavedBanner();
    setAutoCalculate(checked);
    if (checked) {
      setInputs((prev) => ({
        ...prev,
        new_balance_origin: Math.max(0, prev.old_balance_origin - prev.amount),
        new_balance_dest: prev.old_balance_dest + prev.amount,
      }));
    }
  };

  const applyPreset = (preset, nextAutoCalc) => {
    clearSavedBanner();
    setAutoCalculate(nextAutoCalc);
    setInputs({ ...preset });
  };

  const handleReset = () => {
    clearSavedBanner();
    setPreviousResult(null);
    setAutoCalculate(true);
    setInputs({ ...LEGIT_PAYMENT_PRESET });
  };

  const runSimulation = useCallback(async (payloadToSimulate) => {
    if (Number(payloadToSimulate.amount) <= 0) {
      setError(`Transaction amount must be greater than ${CURRENCY_SYMBOL} 0 to run a simulation.`);
      setCalculating(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestIdRef.current;

    setCalculating(true);
    setError("");

    try {
      const data = await simulateTransaction(payloadToSimulate, {
        signal: controller.signal,
      });

      // Ignore if a newer simulation request was already dispatched
      if (reqId !== requestIdRef.current) return;

      if (latestResultRef.current) {
        setPreviousResult(latestResultRef.current);
      }
      latestResultRef.current = data;
      setCurrentResult(data);
      setEvaluatedInputs(payloadToSimulate);
    } catch (err) {
      if (
        err?.name === "CanceledError" ||
        err?.name === "AbortError" ||
        err?.code === "ERR_CANCELED"
      ) {
        return;
      }
      if (reqId !== requestIdRef.current) return;
      setError(
        handleApiError(
          err,
          "Failed to simulate transaction. Please check your parameters."
        )
      );
    } finally {
      if (reqId === requestIdRef.current) {
        setCalculating(false);
      }
    }
  }, []);

  // Call simulateTransaction once immediately on initial mount, and debounce 400ms on subsequent input changes
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      runSimulation(inputs);
      return undefined;
    }

    const timer = setTimeout(() => {
      runSimulation(inputs);
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [inputs, runSimulation]);

  // Cleanup any in-flight request when unmounting
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSaveRealAnalysis = async () => {
    if (Number(inputs.amount) <= 0) {
      setSaveError(`Transaction amount must be greater than ${CURRENCY_SYMBOL} 0 to save.`);
      return;
    }

    setSaving(true);
    setSaveError("");
    setSavedRecord(null);

    try {
      const saved = await predictTransaction(inputs);
      setSavedRecord(saved);
    } catch (err) {
      setSaveError(
        handleApiError(
          err,
          "Failed to save analysis to transaction history."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const riskScore = Number(currentResult?.risk_score) || 0;
  const resolvedRiskLevel =
    currentResult?.risk_level || getRiskLevel(riskScore);
  const isFraudVerdict =
    riskScore >= 0.5 || currentResult?.prediction === "Potential Fraud";
  const verdictLabel = isFraudVerdict ? "Potential Fraud" : "Legitimate";

  // Compute "What changed" strip values comparing currentResult vs previousResult
  const prevScore =
    previousResult != null ? Number(previousResult.risk_score) || 0 : null;
  const prevLevel =
    previousResult != null
      ? previousResult.risk_level || getRiskLevel(prevScore)
      : null;

  const prevPct = prevScore != null ? Math.round(prevScore * 100) : null;
  const currPct = Math.round(riskScore * 100);
  const deltaPoints = prevPct != null ? currPct - prevPct : null;
  const levelChanged = prevLevel != null && prevLevel !== resolvedRiskLevel;

  // Reuse v2 "Why this result" engine from src/utils/riskReasons.js
  const reasonsData = currentResult
    ? buildRiskReasons(
        evaluatedInputs || inputs,
        riskScore,
        resolvedRiskLevel,
        currentResult.top_features || []
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
      {/* Left Column: Interactive Controls Card (5/12 on desktop) */}
      <div className="lg:col-span-5 card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-teal" />
              <h2 className="section-title">
                What-If Controls
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Drag sliders or enter numbers to test how the model reacts in real
              time.
            </p>
          </div>
          {calculating && (
            <span
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 shrink-0"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Simulating...</span>
            </span>
          )}
        </div>

        {/* Preset Buttons */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Presets
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset(FRAUD_TRANSFER_PRESET, false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-risk-high/30 bg-risk-high/5 px-2.5 py-2 text-xs font-semibold text-risk-high hover:bg-risk-high/10 transition-colors cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>Fraud TRANSFER</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset(LEGIT_PAYMENT_PRESET, true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-risk-low/30 bg-risk-low/5 px-2.5 py-2 text-xs font-semibold text-risk-low hover:bg-risk-low/10 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Legit PAYMENT</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-navy transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Transaction Type Segmented Buttons */}
        <div className="space-y-1.5">
          <label className="label">
            Transaction Type
          </label>
          <div
            role="group"
            aria-label="Transaction Type"
            className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 rounded-xl bg-slate-100/90 p-1 border border-slate-200/80"
          >
            {TRANSACTION_TYPES.map((type) => {
              const active = inputs.transaction_type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  aria-pressed={active}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-navy text-white shadow-xs"
                      : "text-slate-600 hover:text-navy hover:bg-white/60"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hour of Day Slider (0 - 23) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="sandbox-hour"
              className="label mb-0"
            >
              Hour of Day (0–23)
            </label>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-navy tabular-nums">
              {formatHourLabel(inputs.hour_of_day)}
              {inputs.hour_of_day >= 0 && inputs.hour_of_day <= 5
                ? " (Overnight)"
                : ""}
            </span>
          </div>
          <input
            id="sandbox-hour"
            type="range"
            min="0"
            max="23"
            step="1"
            value={inputs.hour_of_day}
            onChange={(e) => handleHourChange(e.target.value)}
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>

        {/* Amount Slider + Number Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="sandbox-amount-num"
              className="label mb-0"
            >
              Transaction Amount ({CURRENCY_SYMBOL})
            </label>
            <span className="text-xs font-mono font-medium text-slate-500 tabular-nums">
              {formatCurrency(inputs.amount)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              aria-label="Transaction Amount slider"
              type="range"
              min="0"
              max={MAX_SLIDER_VALUE}
              step="500"
              value={Math.min(MAX_SLIDER_VALUE, inputs.amount)}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            <input
              id="sandbox-amount-num"
              type="number"
              min="1"
              step="any"
              value={inputs.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-28 shrink-0 input py-1.5 px-2.5 text-right font-mono text-xs tabular-nums"
            />
          </div>
        </div>

        {/* Auto-calculate Balances Toggle */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div>
              <span className="block text-xs font-semibold text-navy">
                Auto-calculate balances
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                {autoCalculate
                  ? "Origin & destination after-balances update automatically from amount."
                  : "Manual mode: edit all 4 balances freely to test balance-mismatch patterns."}
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoCalculate}
              onChange={(e) => handleToggleAutoCalculate(e.target.checked)}
              className="mt-0.5"
            />
          </label>
        </div>

        {/* Account Balances Section */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          {/* Old Balance Origin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sandbox-old-origin-num"
                className="label mb-0"
              >
                Origin Balance Before ({CURRENCY_SYMBOL})
              </label>
              <span className="text-xs font-mono font-medium text-slate-500 tabular-nums">
                {formatCurrency(inputs.old_balance_origin)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                aria-label="Origin Balance Before slider"
                type="range"
                min="0"
                max={MAX_SLIDER_VALUE}
                step="500"
                value={Math.min(MAX_SLIDER_VALUE, inputs.old_balance_origin)}
                onChange={(e) => handleOldOriginChange(e.target.value)}
              />
              <input
                id="sandbox-old-origin-num"
                type="number"
                min="0"
                step="any"
                value={inputs.old_balance_origin}
                onChange={(e) => handleOldOriginChange(e.target.value)}
                className="w-28 shrink-0 input py-1.5 px-2.5 text-right font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          {/* New Balance Origin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sandbox-new-origin-num"
                className="label mb-0"
              >
                Origin Balance After ({CURRENCY_SYMBOL})
                {autoCalculate && (
                  <span className="ml-1.5 text-[10px] font-normal text-teal">
                    (auto)
                  </span>
                )}
              </label>
              <span className="text-xs font-mono font-medium text-slate-500 tabular-nums">
                {formatCurrency(inputs.new_balance_origin)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                aria-label="Origin Balance After slider"
                type="range"
                min="0"
                max={MAX_SLIDER_VALUE}
                step="500"
                disabled={autoCalculate}
                value={Math.min(MAX_SLIDER_VALUE, inputs.new_balance_origin)}
                onChange={(e) => handleNewOriginChange(e.target.value)}
                className={autoCalculate ? "opacity-50 cursor-not-allowed" : ""}
              />
              <input
                id="sandbox-new-origin-num"
                type="number"
                min="0"
                step="any"
                disabled={autoCalculate}
                value={inputs.new_balance_origin}
                onChange={(e) => handleNewOriginChange(e.target.value)}
                className={`w-28 shrink-0 input py-1.5 px-2.5 text-right font-mono text-xs tabular-nums ${
                  autoCalculate ? "bg-slate-100 text-slate-500" : ""
                }`}
              />
            </div>
          </div>

          {/* Old Balance Destination */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sandbox-old-dest-num"
                className="label mb-0"
              >
                Destination Balance Before ({CURRENCY_SYMBOL})
              </label>
              <span className="text-xs font-mono font-medium text-slate-500 tabular-nums">
                {formatCurrency(inputs.old_balance_dest)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                aria-label="Destination Balance Before slider"
                type="range"
                min="0"
                max={MAX_SLIDER_VALUE}
                step="500"
                value={Math.min(MAX_SLIDER_VALUE, inputs.old_balance_dest)}
                onChange={(e) => handleOldDestChange(e.target.value)}
              />
              <input
                id="sandbox-old-dest-num"
                type="number"
                min="0"
                step="any"
                value={inputs.old_balance_dest}
                onChange={(e) => handleOldDestChange(e.target.value)}
                className="w-28 shrink-0 input py-1.5 px-2.5 text-right font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          {/* New Balance Destination */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sandbox-new-dest-num"
                className="label mb-0"
              >
                Destination Balance After ({CURRENCY_SYMBOL})
                {autoCalculate && (
                  <span className="ml-1.5 text-[10px] font-normal text-teal">
                    (auto)
                  </span>
                )}
              </label>
              <span className="text-xs font-mono font-medium text-slate-500 tabular-nums">
                {formatCurrency(inputs.new_balance_dest)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                aria-label="Destination Balance After slider"
                type="range"
                min="0"
                max={MAX_SLIDER_VALUE}
                step="500"
                disabled={autoCalculate}
                value={Math.min(MAX_SLIDER_VALUE, inputs.new_balance_dest)}
                onChange={(e) => handleNewDestChange(e.target.value)}
                className={autoCalculate ? "opacity-50 cursor-not-allowed" : ""}
              />
              <input
                id="sandbox-new-dest-num"
                type="number"
                min="0"
                step="any"
                disabled={autoCalculate}
                value={inputs.new_balance_dest}
                onChange={(e) => handleNewDestChange(e.target.value)}
                className={`w-28 shrink-0 input py-1.5 px-2.5 text-right font-mono text-xs tabular-nums ${
                  autoCalculate ? "bg-slate-100 text-slate-500" : ""
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Results Panel (7/12 on desktop) */}
      <div className="lg:col-span-7 space-y-4 md:space-y-6">
        {/* Top Banner: Sandbox Non-Persistence Notice */}
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal/30 bg-teal-50/60 px-4 py-3 text-xs sm:text-sm text-navy shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-4 w-4 text-teal shrink-0" />
            <span className="font-medium">
              Sandbox mode: hypothetical predictions are not written to MongoDB.
            </span>
          </div>
          {calculating && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Updating...</span>
            </span>
          )}
        </div>

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

        {/* "What changed" Delta Strip */}
        {currentResult && previousResult && (
          <div
            aria-label="What changed since previous simulation"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
          >
            <div className="flex items-center gap-2 text-navy">
              {deltaPoints > 0 ? (
                <TrendingUp className="h-4 w-4 text-risk-high shrink-0" />
              ) : deltaPoints < 0 ? (
                <TrendingDown className="h-4 w-4 text-risk-low shrink-0" />
              ) : (
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              )}
              <span className="font-semibold">
                Risk score:{" "}
                <span className="tabular-nums">{prevPct}%</span> →{" "}
                <span className="tabular-nums">{currPct}%</span> (
                <span
                  className={`tabular-nums ${
                    deltaPoints > 0
                      ? "text-risk-high"
                      : deltaPoints < 0
                        ? "text-risk-low"
                        : "text-slate-500"
                  }`}
                >
                  {deltaPoints > 0
                    ? `+${deltaPoints} points`
                    : deltaPoints < 0
                      ? `${deltaPoints} points`
                      : "no change"}
                </span>
                )
              </span>
            </div>

            {levelChanged && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  LEVEL_BADGE_TEXT_CLASSES[resolvedRiskLevel] ||
                  LEVEL_BADGE_TEXT_CLASSES.Low
                }`}
              >
                Risk level shifted: {prevLevel} → {resolvedRiskLevel}
              </span>
            )}
          </div>
        )}

        {/* Live Results Content */}
        {currentResult && (
          <div className="space-y-4 md:space-y-6">
            {/* a) Verdict Card */}
            <div
              className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm border-l-4 transition-colors ${
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
                      Simulated Verdict
                    </p>
                    <h2
                      className={`mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight ${
                        isFraudVerdict ? "text-risk-high" : "text-risk-low"
                      }`}
                    >
                      {verdictLabel}
                    </h2>
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
            </div>

            {/* b) RiskGauge Card */}
            <ChartCard
              title="Fraud Risk Gauge"
              subtitle="Live calibrated probability of fraudulent activity (0% – 100%)"
            >
              <RiskGauge score={riskScore} riskLevel={resolvedRiskLevel} />
            </ChartCard>

            {/* c) SHAP Explanation Chart */}
            <ChartCard
              title="SHAP Feature Attributions"
              subtitle="Top features ranked by absolute Shapley impact on the simulated score"
            >
              <ShapChart
                features={currentResult.top_features || []}
                inputValues={evaluatedInputs || inputs}
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

              {reasonsData?.summary && (
                <p className="text-sm sm:text-base font-bold text-navy leading-snug">
                  {reasonsData.summary}
                </p>
              )}

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

              {orderedSections.length > 0 ? (
                <div className="space-y-4 pt-1">{orderedSections}</div>
              ) : (
                <p className="text-xs text-slate-500">
                  No additional risk or normal signals identified for this
                  transaction.
                </p>
              )}

              {reasonsData?.modelNote && (
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="font-semibold text-navy">Model note:</span>{" "}
                  {reasonsData.modelNote}
                </p>
              )}
            </section>

            {/* e) Save this as a real analysis action */}
            <div className="card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-navy">
                    Want to keep this scenario on record?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Persist the current parameters as an official analysis in
                    MongoDB.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveRealAnalysis}
                  disabled={saving || Number(inputs.amount) <= 0}
                  className="btn-primary shrink-0"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <BookmarkCheck className="h-4 w-4" />
                      <span>Save as real analysis</span>
                    </>
                  )}
                </button>
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-risk-high/30 bg-risk-high/10 px-3.5 py-2.5 text-xs text-risk-high"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {savedRecord && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-risk-low/30 bg-risk-low/10 px-3.5 py-2.5 text-xs sm:text-sm text-navy"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-risk-low shrink-0" />
                    <span>
                      Saved as transaction{" "}
                      <span className="font-mono font-bold tabular-nums">
                        {savedRecord.transaction_id}
                      </span>
                    </span>
                  </div>
                  <Link
                    to="/history"
                    className="inline-flex items-center gap-1 font-semibold text-teal hover:text-teal-700 hover:underline"
                  >
                    <span>View in Transaction History</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Risk Levels Footnote */}
            <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 py-1">
              <Info className="h-3.5 w-3.5 text-teal shrink-0" />
              <span>
                Risk tiers: Low &lt; 0.30, Medium 0.30 to 0.70, High &gt; 0.70
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
