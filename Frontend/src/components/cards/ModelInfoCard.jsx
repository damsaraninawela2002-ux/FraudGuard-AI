import {
  Calendar,
  Cpu,
  Database,
  Layers,
  Percent,
  Sliders,
} from "lucide-react";
import {
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatPercent,
} from "../../utils/format";

export default function ModelInfoCard({ metrics, loading = false }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-md bg-slate-200" />
            <div className="h-3.5 w-64 rounded-md bg-slate-100" />
          </div>
          <div className="h-6 w-32 rounded-full bg-slate-200" />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded-md bg-slate-100" />
              <div className="h-5 w-32 rounded-md bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const cm = metrics.confusion_matrix || {};
  const tn = Number(cm.tn) || 0;
  const fp = Number(cm.fp) || 0;
  const fn = Number(cm.fn) || 0;
  const tp = Number(cm.tp) || 0;
  const testTotal = tn + fp + fn + tp;
  const testFraudCount = fn + tp;
  const testFraudRatioPct =
    testTotal > 0 ? (testFraudCount / testTotal) * 100 : null;

  const infoItems = [
    {
      label: "Model Architecture",
      value: metrics.model_name || "XGBClassifier",
      icon: Cpu,
    },
    {
      label: "Trained Date",
      value: metrics.trained_at ? formatDateTime(metrics.trained_at) : "—",
      icon: Calendar,
    },
    {
      label: "Decision Threshold",
      value:
        metrics.threshold !== undefined && metrics.threshold !== null
          ? formatDecimal(metrics.threshold, 2)
          : "0.50",
      icon: Sliders,
    },
    ...(testTotal > 0
      ? [
          {
            label: "Held-Out Test Set",
            value: `${formatNumber(testTotal)} samples (${formatNumber(testFraudCount)} fraud)`,
            icon: Database,
          },
          {
            label: "Test Fraud Ratio",
            value: formatPercent(testFraudRatioPct, 2),
            icon: Percent,
          },
        ]
      : []),
    ...(metrics.num_features
      ? [
          {
            label: "Features",
            value: formatNumber(metrics.num_features),
            icon: Layers,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-teal shadow-xs border border-teal/20">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-navy tracking-tight">
              {metrics.model_name || "Fraud Detection Classifier"}
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated offline on held-out test transactions
            </p>
          </div>
        </div>

        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
          <span>Production model</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {infoItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl bg-surface p-3.5 border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Icon className="h-3.5 w-3.5 text-teal shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-navy truncate tabular-nums">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
