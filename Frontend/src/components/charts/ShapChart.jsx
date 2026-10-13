import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFeatureLabelWithValue } from "../../utils/featureLabels";
import { riskColors } from "../../utils/risk";

const COLOR_NAVY = "#0F172A";
const COLOR_SLATE_500 = "#64748B";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const val = Number(item.shap_value) || 0;
  const formattedVal = `${val >= 0 ? "+" : ""}${val.toFixed(4)}`;
  const increases = item.direction === "increases_risk" || val > 0;
  const badgeColor = increases ? riskColors.High : riskColors.Low;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <p className="font-bold text-navy">{item.label}</p>
      <p className="text-[11px] font-mono text-slate-400">{item.feature}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5">
        <span className="text-slate-600">SHAP Attribution:</span>
        <span
          className="font-mono font-bold tabular-nums"
          style={{ color: badgeColor }}
        >
          {formattedVal}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: badgeColor }}
        />
        <span>
          {increases
            ? "Pushes toward Fraud (increases risk)"
            : "Pushes toward Legitimate (reduces risk)"}
        </span>
      </div>
    </div>
  );
}

export default function ShapChart({ features = [], inputValues = {} }) {
  const chartData = (Array.isArray(features) ? features : [])
    .slice(0, 8)
    .map((f) => {
      const val = Number(f.shap_value) || 0;
      const increases = f.direction === "increases_risk" || val > 0;
      return {
        feature: f.feature,
        label: getFeatureLabelWithValue(f.feature, inputValues),
        shap_value: val,
        direction:
          f.direction || (val > 0 ? "increases_risk" : "decreases_risk"),
        color: increases ? riskColors.High : riskColors.Low,
      };
    });

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-500">
        No SHAP feature attributions available for this transaction.
      </div>
    );
  }

  return (
    <div className="flex flex-col" aria-label="SHAP feature attributions bar chart">
      <div className="h-64 w-full">
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
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={185}
              tick={{ fill: COLOR_NAVY, fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "#F8FAFC" }}
            />
            <ReferenceLine x={0} stroke="#94A3B8" strokeWidth={1.5} />
            <Bar
              dataKey="shap_value"
              name="SHAP Attribution"
              radius={[4, 4, 4, 4]}
              maxBarSize={22}
            >
              {chartData.map((entry) => (
                <Cell key={entry.feature} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Caption */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: riskColors.High }}
            />
            <span className="font-semibold text-navy">Increases fraud risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: riskColors.Low }}
            />
            <span className="font-semibold text-navy">Decreases fraud risk</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-500">
          Red bars push score toward fraud; green toward legitimate.
        </span>
      </div>
    </div>
  );
}
