import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ScanSearch, TrendingUp } from "lucide-react";
import { formatNumber } from "../../utils/format";

const COLOR_TEAL = "#14B8A6";
const COLOR_RISK_HIGH = "#EF4444";
const COLOR_SLATE_500 = "#64748B";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs">
      <p className="font-bold text-navy mb-1.5">{row?.date || label}</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 py-0.5 text-slate-600"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
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

export default function FraudTrendChart({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex h-72 flex-col justify-between p-2 animate-pulse">
        <div className="h-52 w-full rounded-xl bg-slate-100" />
        <div className="flex justify-center gap-6 pt-3">
          <div className="h-3 w-24 rounded-md bg-slate-200" />
          <div className="h-3 w-24 rounded-md bg-slate-200" />
        </div>
      </div>
    );
  }

  const hasActivity =
    Array.isArray(data) &&
    data.length > 0 &&
    data.some((d) => (Number(d.total) || 0) > 0 || (Number(d.fraud) || 0) > 0);

  if (!hasActivity) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal border border-teal-100 mb-3">
          <TrendingUp className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-navy">No activity trend yet</p>
        <p className="mt-1 text-xs text-slate-500 max-w-xs">
          Daily transaction volume and fraud detection trends will plot automatically
          as transactions are analyzed.
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
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_TEAL} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_TEAL} stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={COLOR_RISK_HIGH}
                  stopOpacity={0.28}
                />
                <stop
                  offset="95%"
                  stopColor={COLOR_RISK_HIGH}
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F1F5F9"
            />
            <XAxis
              dataKey="label"
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
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              name="Total Transactions"
              stroke={COLOR_TEAL}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#totalGrad)"
            />
            <Area
              type="monotone"
              dataKey="fraud"
              name="Fraud Detected"
              stroke={COLOR_RISK_HIGH}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#fraudGrad)"
            />
          </AreaChart>
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
