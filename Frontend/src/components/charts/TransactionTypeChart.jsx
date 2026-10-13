import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ScanSearch } from "lucide-react";
import { formatNumber } from "../../utils/format";

const COLOR_TEAL = "#14B8A6";
const COLOR_RISK_HIGH = "#EF4444";
const COLOR_SLATE_500 = "#64748B";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <p className="font-bold text-navy mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 py-0.5 text-slate-600"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <span>{entry.name}:</span>
          </div>
          <span className="font-bold text-navy tabular-nums">
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TransactionTypeChart({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex h-72 flex-col justify-between p-2 animate-pulse">
        <div className="flex h-52 items-end justify-around gap-4 px-4">
          <div className="h-32 w-10 rounded-t-lg bg-slate-200" />
          <div className="h-44 w-10 rounded-t-lg bg-slate-200" />
          <div className="h-24 w-10 rounded-t-lg bg-slate-200" />
          <div className="h-36 w-10 rounded-t-lg bg-slate-200" />
          <div className="h-16 w-10 rounded-t-lg bg-slate-200" />
        </div>
        <div className="flex justify-center gap-6 pt-3">
          <div className="h-3 w-24 rounded-md bg-slate-200" />
          <div className="h-3 w-24 rounded-md bg-slate-200" />
        </div>
      </div>
    );
  }

  const totalCount = Array.isArray(data)
    ? data.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
    : 0;

  if (totalCount === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal border border-teal-100 mb-3">
          <BarChart3 className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-navy">No channel volume yet</p>
        <p className="mt-1 text-xs text-slate-500 max-w-xs">
          Breakdown across PAYMENT, TRANSFER, CASH_OUT, CASH_IN, and
          DEBIT channels will plot here.
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
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F1F5F9"
            />
            <XAxis
              dataKey="type"
              tick={{ fill: COLOR_SLATE_500, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: COLOR_SLATE_500, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "#F8FAFC" }}
            />
            <Bar
              dataKey="total"
              name="Total"
              fill={COLOR_TEAL}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="fraud"
              name="Fraud"
              fill={COLOR_RISK_HIGH}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: COLOR_TEAL }}
          />
          <span className="font-semibold text-navy">Total Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: COLOR_RISK_HIGH }}
          />
          <span className="font-semibold text-navy">Fraud Detected</span>
        </div>
      </div>
    </div>
  );
}
