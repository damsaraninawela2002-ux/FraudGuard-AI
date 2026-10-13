import { formatNumber, formatPercent } from "../../utils/format";

export default function ConfusionMatrix({
  matrix,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
        </div>
        <div className="h-4 w-3/4 rounded-md bg-slate-200 mx-auto" />
      </div>
    );
  }

  if (
    !matrix ||
    matrix.tn === undefined ||
    matrix.fp === undefined ||
    matrix.fn === undefined ||
    matrix.tp === undefined
  ) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-surface p-6 text-center border border-slate-100">
        <p className="text-sm font-bold text-navy">Not available</p>
        <p className="mt-1 text-xs text-slate-500">
          Confusion matrix counts were not returned by the backend.
        </p>
      </div>
    );
  }

  const tn = Number(matrix.tn) || 0;
  const fp = Number(matrix.fp) || 0;
  const fn = Number(matrix.fn) || 0;
  const tp = Number(matrix.tp) || 0;

  const total = tn + fp + fn + tp;
  const totalFraud = fn + tp;
  const totalLegit = tn + fp;

  const tnPct = total > 0 ? (tn / total) * 100 : 0;
  const fpPct = total > 0 ? (fp / total) * 100 : 0;
  const fnPct = total > 0 ? (fn / total) * 100 : 0;
  const tpPct = total > 0 ? (tp / total) * 100 : 0;

  const caughtPct = totalFraud > 0 ? (tp / totalFraud) * 100 : 0;

  return (
    <div className="flex flex-col space-y-4">
      {/* Column Axis Header: Predicted */}
      <div className="text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Predicted Class
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
        {/* Row Axis Header: Actual */}
        <div className="flex flex-col items-center justify-around h-full py-6 pr-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 [writing-mode:vertical-lr] rotate-180">
            Actual Class
          </span>
        </div>

        <div className="space-y-3">
          {/* Predicted Labels Row */}
          <div className="grid grid-cols-2 gap-3.5 text-center text-xs font-bold text-navy">
            <div className="rounded-xl bg-surface py-2 border border-slate-200">
              Predicted: Legitimate
            </div>
            <div className="rounded-xl bg-surface py-2 border border-slate-200">
              Predicted: Fraud
            </div>
          </div>

          {/* 2x2 Matrix Cells */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Top-Left: True Negative (Actual Legitimate, Predicted Legitimate) */}
            <div className="relative rounded-2xl border border-teal/30 bg-teal-50/70 p-4 text-center transition hover:shadow-xs">
              <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800 border border-teal-100 shadow-2xs">
                Actual: Legitimate &bull; TN
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-navy tabular-nums">
                {formatNumber(tn)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-teal-700 tabular-nums">
                {formatPercent(tnPct, 2)} of total
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                True Negative (Correct Legit)
              </p>
            </div>

            {/* Top-Right: False Positive (Actual Legitimate, Predicted Fraud) */}
            <div className="relative rounded-2xl border border-risk-medium/35 bg-amber-50/70 p-4 text-center transition hover:shadow-xs">
              <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 border border-amber-100 shadow-2xs">
                Actual: Legitimate &bull; FP
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-navy tabular-nums">
                {formatNumber(fp)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-amber-700 tabular-nums">
                {formatPercent(fpPct, 2)} of total
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                False Positive (False Alarm)
              </p>
            </div>

            {/* Bottom-Left: False Negative (Actual Fraud, Predicted Legitimate) */}
            <div className="relative rounded-2xl border border-risk-high/35 bg-red-50/70 p-4 text-center transition hover:shadow-xs">
              <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800 border border-red-100 shadow-2xs">
                Actual: Fraud &bull; FN
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-navy tabular-nums">
                {formatNumber(fn)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-red-700 tabular-nums">
                {formatPercent(fnPct, 2)} of total
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                False Negative (Missed Fraud)
              </p>
            </div>

            {/* Bottom-Right: True Positive (Actual Fraud, Predicted Fraud) */}
            <div className="relative rounded-2xl border border-risk-low/35 bg-emerald-50/70 p-4 text-center transition hover:shadow-xs">
              <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-100 shadow-2xs">
                Actual: Fraud &bull; TP
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-navy tabular-nums">
                {formatNumber(tp)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
                {formatPercent(tpPct, 2)} of total
              </p>
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                True Positive (Caught Fraud)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-Line Plain-English Reading */}
      <div className="rounded-xl border border-slate-200 bg-surface px-4 py-3 text-xs text-slate-700 text-center leading-relaxed">
        Out of{" "}
        <span className="font-semibold text-navy tabular-nums">
          {formatNumber(totalFraud)}
        </span>{" "}
        real fraud cases, the model caught{" "}
        <span className="font-semibold text-emerald-700 tabular-nums">
          {formatNumber(tp)} ({formatPercent(caughtPct, 2)})
        </span>{" "}
        and missed{" "}
        <span className="font-semibold text-risk-high tabular-nums">{formatNumber(fn)}</span>
        , while raising{" "}
        <span className="font-semibold text-amber-700 tabular-nums">
          {formatNumber(fp)}
        </span>{" "}
        false alarms across{" "}
        <span className="font-semibold text-navy tabular-nums">
          {formatNumber(totalLegit)}
        </span>{" "}
        legitimate transactions.
      </div>
    </div>
  );
}
