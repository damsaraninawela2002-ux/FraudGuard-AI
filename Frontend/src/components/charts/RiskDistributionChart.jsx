import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon, ScanSearch } from "lucide-react";
import { riskColors } from "../../utils/risk";
import { formatNumber, formatPercent } from "../../utils/format";

function CustomTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;

  const entry = payload[0];
  const count = Number(entry.value) || 0;
  const pct = total > 0 ? (count / total) * 100 : 0;
  const color = riskColors[entry.name] || riskColors.Low;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <div className="flex items-center gap-2 font-bold text-navy">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span>{entry.name} Risk Tier</span>
      </div>
      <div className="mt-1 text-slate-600">
        Count:{" "}
        <span className="font-bold text-navy tabular-nums">{formatNumber(count)}</span>{" "}
        <span className="tabular-nums">({formatPercent(pct)})</span>
      </div>
    </div>
  );
}

export default function RiskDistributionChart({
  data = [],
  total = 0,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4 animate-pulse">
        <div className="h-44 w-44 rounded-full border-16 border-slate-200" />
        <div className="flex items-center gap-6">
          <div className="h-3 w-16 rounded-md bg-slate-200" />
          <div className="h-3 w-16 rounded-md bg-slate-200" />
          <div className="h-3 w-16 rounded-md bg-slate-200" />
        </div>
      </div>
    );
  }

  const calculatedTotal =
    total > 0
      ? total
      : data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (calculatedTotal === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal border border-teal-100 mb-3">
          <PieChartIcon className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-navy">No transactions evaluated</p>
        <p className="mt-1 text-xs text-slate-500 max-w-xs">
          Evaluate transactions to visualize Low, Medium, and High risk
          tier distribution.
        </p>
        <Link
          to="/analyze"
          className="mt-4 btn-primary text-xs py-2 px-3.5"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          <span>Analyze Transaction</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Donut Chart with Centered Total */}
      <div className="relative h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={riskColors[entry.name] || riskColors.Low}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={calculatedTotal} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centered Donut Total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-navy tracking-tight tabular-nums">
            {formatNumber(calculatedTotal)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Analyzed
          </span>
        </div>
      </div>

      {/* Custom Legend with Counts & Percentages */}
      <div className="mt-3 grid grid-cols-3 gap-2.5 border-t border-slate-100 pt-3">
        {data.map((item) => {
          const count = Number(item.value) || 0;
          const pct = calculatedTotal > 0 ? (count / calculatedTotal) * 100 : 0;
          const color = riskColors[item.name] || riskColors.Low;

          return (
            <div
              key={item.name}
              className="flex flex-col items-center rounded-xl bg-surface px-2.5 py-2 text-center border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{item.name}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-navy tabular-nums">
                {formatNumber(count)}
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {formatPercent(pct, 1)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
