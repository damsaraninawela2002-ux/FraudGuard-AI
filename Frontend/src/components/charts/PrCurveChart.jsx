import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatDecimal } from "../../utils/format";

const COLOR_TEAL = "#14B8A6";
const COLOR_SLATE_500 = "#64748B";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">Recall:</span>
        <span className="font-mono font-bold text-navy tabular-nums">
          {formatDecimal(point.recall, 4)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-slate-600">Precision:</span>
        <span className="font-mono font-bold text-teal tabular-nums">
          {formatDecimal(point.precision, 4)}
        </span>
      </div>
    </div>
  );
}

export default function PrCurveChart({
  points = [],
  prAuc,
  loading = false,
}) {
  if (loading) {
    return <div className="h-64 w-full rounded-2xl bg-slate-100 animate-pulse" />;
  }

  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-surface p-6 text-center border border-slate-100">
        <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="text-sm font-bold text-navy">Not available</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Raw Precision-Recall curve coordinates are not included in{" "}
          <span className="font-mono font-semibold">GET /api/model/metrics</span>.
          {prAuc !== undefined && (
            <>
              {" "}
              Summary PR-AUC:{" "}
              <span className="font-bold text-navy tabular-nums">
                {formatDecimal(prAuc, 4)}
              </span>
              .
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR_TEAL} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLOR_TEAL} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            type="number"
            dataKey="recall"
            domain={[0, 1]}
            tick={{ fill: COLOR_SLATE_500, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="precision"
            domain={[0, 1]}
            tick={{ fill: COLOR_SLATE_500, fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="precision"
            stroke={COLOR_TEAL}
            strokeWidth={2.5}
            fill="url(#prGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
