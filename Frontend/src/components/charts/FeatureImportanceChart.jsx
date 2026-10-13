import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { getFeatureLabel } from "../../utils/featureLabels";
import { formatDecimal } from "../../utils/format";

const COLOR_TEAL = "#14B8A6";
const COLOR_NAVY = "#0F172A";
const COLOR_SLATE_500 = "#64748B";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <p className="font-bold text-navy">{item.label}</p>
      <p className="text-[11px] font-mono text-slate-400">{item.feature}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="text-slate-600">Global Importance:</span>
        <span className="font-mono font-bold text-teal tabular-nums">
          {formatDecimal(item.importance, 4)}
        </span>
      </div>
    </div>
  );
}

export default function FeatureImportanceChart({
  features = [],
  loading = false,
}) {
  if (loading) {
    return (
      <div className="space-y-3 py-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-32 rounded-md bg-slate-200" />
            <div className="h-5 flex-1 rounded-md bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  const chartData = (Array.isArray(features) ? features : [])
    .slice(0, 10)
    .map((f) => ({
      feature: f.feature || f.name,
      label: getFeatureLabel(f.feature || f.name),
      importance: Number(f.importance ?? f.value) || 0,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-surface p-6 text-center border border-slate-100">
        <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm font-bold text-navy">Not available</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Global feature importance array is not returned by{" "}
          <span className="font-mono font-semibold">GET /api/model/metrics</span>. Per-transaction
          SHAP feature attributions are available on the Analyze Transaction and
          Transaction History pages.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 20, left: 12, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={true}
            vertical={false}
            stroke="#F1F5F9"
          />
          <XAxis
            type="number"
            tick={{ fill: COLOR_SLATE_500, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: COLOR_NAVY, fontSize: 11, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
          <Bar
            dataKey="importance"
            fill={COLOR_TEAL}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
