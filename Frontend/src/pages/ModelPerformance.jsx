import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Gauge,
  Info,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useModelMetrics } from "../hooks/useModelMetrics";
import ModelInfoCard from "../components/cards/ModelInfoCard";
import StatCard from "../components/cards/StatCard";
import ChartCard from "../components/charts/ChartCard";
import ConfusionMatrix from "../components/charts/ConfusionMatrix";
import RocCurveChart from "../components/charts/RocCurveChart";
import PrCurveChart from "../components/charts/PrCurveChart";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import { formatDecimal, formatPercent } from "../utils/format";

const METRIC_GLOSSARY = [
  {
    term: "Precision",
    definition:
      "Out of all transactions the model flagged as fraud, the percentage that were actually fraudulent. High precision means fewer false alarms for legitimate customers.",
  },
  {
    term: "Recall (Sensitivity)",
    definition:
      "Out of all real fraudulent transactions in the test set, the percentage the model successfully caught. High recall means fewer frauds slip through undetected.",
  },
  {
    term: "F1 Score",
    definition:
      "The harmonic mean of Precision and Recall. It provides a single balanced score when both catching fraud and avoiding false alarms matter.",
  },
  {
    term: "PR-AUC (Precision-Recall AUC)",
    definition:
      "Area under the Precision-Recall curve across all decision thresholds. This is the most informative overall metric for heavily imbalanced fraud datasets.",
  },
  {
    term: "ROC-AUC",
    definition:
      "Area under the Receiver Operating Characteristic curve (0.0 to 1.0). Measures the probability that the model ranks a random fraud transaction higher than a random legitimate one.",
  },
  {
    term: "Confusion Matrix",
    definition:
      "A 2×2 breakdown of predictions at the active decision threshold: True Negatives (correct legit), False Positives (false alarms), False Negatives (missed frauds), and True Positives (caught frauds).",
  },
];

export default function ModelPerformance() {
  const { metrics, loading, error, refetch } = useModelMetrics();
  const [guideOpen, setGuideOpen] = useState(false);

  // Compute accuracy from confusion_matrix if not provided directly
  const computedMetrics = useMemo(() => {
    if (!metrics) return null;

    const cm = metrics.confusion_matrix || {};
    const tn = Number(cm.tn) || 0;
    const fp = Number(cm.fp) || 0;
    const fn = Number(cm.fn) || 0;
    const tp = Number(cm.tp) || 0;
    const total = tn + fp + fn + tp;

    const accuracy =
      metrics.accuracy !== undefined && metrics.accuracy !== null
        ? Number(metrics.accuracy)
        : total > 0
        ? (tp + tn) / total
        : null;

    return {
      accuracyPct: accuracy !== null ? accuracy * 100 : null,
      precisionPct: (Number(metrics.precision) || 0) * 100,
      recallPct: (Number(metrics.recall) || 0) * 100,
      f1Pct: (Number(metrics.f1_score ?? metrics.f1) || 0) * 100,
      prAucPct:
        metrics.pr_auc !== undefined && metrics.pr_auc !== null
          ? Number(metrics.pr_auc) * 100
          : null,
      rocAuc: Number(metrics.roc_auc) || 0,
    };
  }, [metrics]);

  // Check whether optional curve / importance arrays are present in backend response
  const rocPoints = metrics?.roc_curve || metrics?.roc_points || [];
  const prPoints = metrics?.pr_curve || metrics?.pr_points || [];
  const featureImportances =
    metrics?.feature_importances || metrics?.top_features || [];

  const hasRocPoints = Array.isArray(rocPoints) && rocPoints.length > 0;
  const hasPrPoints = Array.isArray(prPoints) && prPoints.length > 0;
  const hasFeatureImportances =
    Array.isArray(featureImportances) && featureImportances.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            Model Performance
          </h1>
          <p className="page-subtitle">
            Offline evaluation benchmarks and diagnostic curves on held-out test data.
          </p>
        </div>

        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          aria-label="Refresh model performance metrics"
          className="btn-secondary self-start sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 text-teal ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-risk-high/30 bg-risk-high/10 px-4 py-3.5 text-sm text-risk-high shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="btn-danger text-xs px-3 py-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Row 1: Model Info Card */}
      <ModelInfoCard metrics={metrics} loading={loading} />

      {/* Row 2: Metric StatCards */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
          <StatCard
            title="Accuracy"
            value={
              computedMetrics?.accuracyPct !== null &&
              computedMetrics?.accuracyPct !== undefined
                ? formatPercent(computedMetrics.accuracyPct, 2)
                : "—"
            }
            subtitle="Overall correct rate"
            icon={ShieldCheck}
            accent="navy"
            loading={loading}
          />

          <StatCard
            title="Precision"
            value={formatPercent(computedMetrics?.precisionPct, 2)}
            subtitle="Flagged that are real fraud"
            icon={Crosshair}
            accent="teal"
            loading={loading}
          />

          <StatCard
            title="Recall"
            value={formatPercent(computedMetrics?.recallPct, 2)}
            subtitle="Real frauds detected"
            icon={Activity}
            accent="low"
            loading={loading}
          />

          <StatCard
            title="F1 Score"
            value={formatPercent(computedMetrics?.f1Pct, 2)}
            subtitle="Harmonic mean score"
            icon={Award}
            accent="teal"
            loading={loading}
          />

          {computedMetrics?.prAucPct !== null && (
            <StatCard
              title="PR-AUC"
              value={formatPercent(computedMetrics?.prAucPct, 2)}
              subtitle="PR curve area"
              icon={TrendingUp}
              accent="low"
              loading={loading}
            />
          )}

          <StatCard
            title="ROC-AUC"
            value={formatDecimal(computedMetrics?.rocAuc, 4)}
            subtitle="Separation capability (0–1)"
            icon={Gauge}
            accent="navy"
            loading={loading}
          />
        </div>

        {/* Imbalanced Data Note */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-600 shadow-2xs">
          <Info className="h-4 w-4 text-teal shrink-0" />
          <span>
            On highly imbalanced fraud datasets, raw accuracy is secondary. Prioritize{" "}
            <span className="font-semibold text-navy">
              Precision, Recall, F1 and PR-AUC
            </span>{" "}
            for operational fraud decisions.
          </span>
        </div>
      </div>

      {/* Row 3: Confusion Matrix (+ ROC Curve if points are provided by backend) */}
      <div
        className={`grid grid-cols-1 ${
          hasRocPoints ? "lg:grid-cols-2" : ""
        } gap-4 md:gap-6`}
      >
        <ChartCard
          title="Confusion Matrix"
          subtitle={`Classification breakdown on held-out test set (Threshold = ${
            metrics?.threshold !== undefined
              ? formatDecimal(metrics.threshold, 2)
              : "0.50"
          })`}
        >
          <ConfusionMatrix
            matrix={metrics?.confusion_matrix}
            loading={loading}
          />
        </ChartCard>

        {hasRocPoints && (
          <ChartCard
            title="ROC Curve"
            subtitle="True Positive Rate vs. False Positive Rate"
            action={
              metrics?.roc_auc !== undefined && (
                <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700 tabular-nums">
                  AUC: {formatDecimal(metrics.roc_auc, 4)}
                </span>
              )
            }
          >
            <RocCurveChart
              points={rocPoints}
              rocAuc={metrics?.roc_auc}
              loading={loading}
            />
          </ChartCard>
        )}
      </div>

      {/* Row 4: Precision-Recall Curve & Feature Importance */}
      {(hasPrPoints || hasFeatureImportances) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {hasPrPoints && (
            <ChartCard
              title="Precision-Recall Curve"
              subtitle="Precision vs. Recall across decision thresholds"
              action={
                metrics?.pr_auc !== undefined && (
                  <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700 tabular-nums">
                    PR-AUC: {formatDecimal(metrics.pr_auc, 4)}
                  </span>
                )
              }
            >
              <PrCurveChart
                points={prPoints}
                prAuc={metrics?.pr_auc}
                loading={loading}
              />
            </ChartCard>
          )}

          {hasFeatureImportances && (
            <ChartCard
              title="Feature Importance"
              subtitle="Top global features ranked by model importance"
            >
              <FeatureImportanceChart
                features={featureImportances}
                loading={loading}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* Collapsible "How to read these metrics" Guide */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((prev) => !prev)}
          aria-expanded={guideOpen}
          className="flex w-full items-center justify-between px-5 py-4 sm:px-6 text-left hover:bg-surface transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/40 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal border border-teal-100">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-navy">
                How to read these metrics
              </h2>
              <p className="text-xs text-slate-500">
                Plain-English guide to fraud classification &amp; evaluation terms
              </p>
            </div>
          </div>

          {guideOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>

        {guideOpen && (
          <div className="border-t border-slate-100 px-5 py-4 sm:px-6 bg-surface/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {METRIC_GLOSSARY.map((item) => (
                <div
                  key={item.term}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <p className="text-xs font-bold text-navy">{item.term}</p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
