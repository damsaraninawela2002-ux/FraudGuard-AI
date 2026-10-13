import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock,
  Gauge,
  Percent,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
} from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import StatCard from "../components/cards/StatCard";
import RiskBadge from "../components/cards/RiskBadge";
import ChartCard from "../components/charts/ChartCard";
import RiskDistributionChart from "../components/charts/RiskDistributionChart";
import FraudTrendChart from "../components/charts/FraudTrendChart";
import TransactionTypeChart from "../components/charts/TransactionTypeChart";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  shortId,
} from "../utils/format";

const TRANSACTION_TYPES = [
  "PAYMENT",
  "TRANSFER",
  "CASH_OUT",
  "CASH_IN",
  "DEBIT",
];

function extractDateKey(isoString) {
  if (!isoString) return null;
  try {
    let input = isoString;
    if (
      typeof isoString === "string" &&
      !isoString.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(isoString)
    ) {
      input = `${isoString}Z`;
    }
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function formatShortDayLabel(dateKey) {
  if (!dateKey) return "";
  try {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return dateKey;
  }
}

export default function Dashboard() {
  const { stats, transactions, loading, error, refetch } = useDashboardData();

  // 1. Direct & Derived KPI Metrics
  const kpis = useMemo(() => {
    const totalTransactions = Number(stats?.total_analyzed) || 0;
    const fraudDetected = Number(stats?.potential_fraud_count) || 0;

    // Derived: Fraud Rate % = (potential_fraud_count / total_analyzed) * 100
    const fraudRate =
      totalTransactions > 0 ? (fraudDetected / totalTransactions) * 100 : 0;

    // Derived: Avg Risk Score across loaded transactions
    const validScores = transactions
      .map((tx) => Number(tx.risk_score))
      .filter((s) => !Number.isNaN(s));
    const avgRiskScorePct =
      validScores.length > 0
        ? (validScores.reduce((acc, s) => acc + s, 0) / validScores.length) *
          100
        : 0;

    return {
      totalTransactions,
      fraudDetected,
      fraudRate,
      avgRiskScorePct,
    };
  }, [stats, transactions]);

  // 2. Risk Distribution Data (Directly from stats.counts_per_risk_level / stats.risk_level_counts)
  const riskDistributionData = useMemo(() => {
    const counts =
      stats?.counts_per_risk_level || stats?.risk_level_counts || {};
    return [
      { name: "Low", value: Number(counts.Low) || 0 },
      { name: "Medium", value: Number(counts.Medium) || 0 },
      { name: "High", value: Number(counts.High) || 0 },
    ];
  }, [stats]);

  // 3. Fraud Trend Data (Derived daily total transactions from `transactions` merged with `stats.fraud_per_day`)
  const fraudTrendData = useMemo(() => {
    const dayMap = new Map();

    // Seed from backend's 30-day fraud_per_day aggregation
    const backendDailyFraud = Array.isArray(stats?.fraud_per_day)
      ? stats.fraud_per_day
      : [];
    backendDailyFraud.forEach((entry) => {
      if (entry?.date) {
        dayMap.set(entry.date, {
          date: entry.date,
          total: Number(entry.count) || 0,
          fraud: Number(entry.count) || 0,
          txTotalCount: 0,
          txFraudCount: 0,
        });
      }
    });

    // Aggregate daily total and fraud counts from fetched transactions
    transactions.forEach((tx) => {
      const dateKey = extractDateKey(tx.created_at);
      if (!dateKey) return;

      const existing = dayMap.get(dateKey) || {
        date: dateKey,
        total: 0,
        fraud: 0,
        txTotalCount: 0,
        txFraudCount: 0,
      };

      existing.txTotalCount += 1;
      if (tx.prediction === "Potential Fraud") {
        existing.txFraudCount += 1;
      }
      dayMap.set(dateKey, existing);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();
    return sortedDates.map((dateKey) => {
      const item = dayMap.get(dateKey);
      const fraud = Math.max(item.fraud, item.txFraudCount);
      const total = Math.max(item.txTotalCount, fraud);
      return {
        date: dateKey,
        label: formatShortDayLabel(dateKey),
        total,
        fraud,
      };
    });
  }, [stats, transactions]);

  // 4. Transactions by Type Data (Derived from `transactions` list across the 5 payment types)
  const transactionTypeData = useMemo(() => {
    const typeCounts = {};
    TRANSACTION_TYPES.forEach((type) => {
      typeCounts[type] = { type, total: 0, fraud: 0 };
    });

    transactions.forEach((tx) => {
      const rawType = String(tx.transaction_type || "")
        .trim()
        .toUpperCase();
      if (!typeCounts[rawType]) {
        typeCounts[rawType] = { type: rawType || "OTHER", total: 0, fraud: 0 };
      }
      typeCounts[rawType].total += 1;
      if (tx.prediction === "Potential Fraud") {
        typeCounts[rawType].fraud += 1;
      }
    });

    return TRANSACTION_TYPES.map((type) => typeCounts[type]);
  }, [transactions]);

  // 5. Recent 5 Transactions
  const recentTransactions = useMemo(
    () => transactions.slice(0, 5),
    [transactions]
  );

  return (
    <div className="space-y-6">
      {/* Page Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of fraud detection activity &amp; real-time risk intelligence
          </p>
        </div>

        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          aria-label="Refresh dashboard data"
          className="btn-secondary self-start sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 text-teal ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh Data</span>
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
            className="btn-danger self-start sm:self-auto text-xs px-3 py-1.5 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Row 1: Four KPI StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Total Transactions"
          value={formatNumber(kpis.totalTransactions)}
          subtitle="All-time evaluated records"
          icon={Activity}
          accent="navy"
          loading={loading}
        />
        <StatCard
          title="Fraud Detected"
          value={formatNumber(kpis.fraudDetected)}
          subtitle="Flagged as Potential Fraud"
          icon={ShieldAlert}
          accent="high"
          loading={loading}
        />
        <StatCard
          title="Fraud Rate"
          value={formatPercent(kpis.fraudRate, 1)}
          subtitle="Share of flagged transactions"
          icon={Percent}
          accent="medium"
          loading={loading}
        />
        <StatCard
          title="Avg Risk Score"
          value={formatPercent(kpis.avgRiskScorePct, 1)}
          subtitle={
            transactions.length > 0
              ? `Across latest ${formatNumber(transactions.length)} records`
              : "Mean calibrated score"
          }
          icon={Gauge}
          accent="teal"
          loading={loading}
        />
      </div>

      {/* Row 2: Risk Distribution & Fraud Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard
          title="Risk Distribution"
          subtitle="Transactions categorized by Low, Medium, and High risk tiers"
        >
          <RiskDistributionChart
            data={riskDistributionData}
            total={kpis.totalTransactions}
            loading={loading}
          />
        </ChartCard>

        <ChartCard
          title="Fraud Trend"
          subtitle="Daily transaction volume vs. detected fraud over time"
        >
          <FraudTrendChart data={fraudTrendData} loading={loading} />
        </ChartCard>
      </div>

      {/* Row 3: Transactions by Type & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard
          title="Transactions by Type"
          subtitle="Total vs. fraudulent volume by payment channel"
        >
          <TransactionTypeChart data={transactionTypeData} loading={loading} />
        </ChartCard>

        <ChartCard
          title="Recent Transactions"
          subtitle="Latest 5 evaluated transactions"
          action={
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:text-teal-700 hover:underline transition"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3 py-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0"
                >
                  <div className="h-4 w-20 rounded-md bg-slate-200" />
                  <div className="h-4 w-16 rounded-md bg-slate-100" />
                  <div className="h-4 w-20 rounded-md bg-slate-200" />
                  <div className="h-5 w-20 rounded-full bg-slate-100" />
                  <div className="h-3.5 w-24 rounded-md bg-slate-100" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal mb-3">
                <Clock className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-navy">
                No transactions yet
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs">
                Recently evaluated transactions and their risk scores will
                appear here.
              </p>
              <Link
                to="/analyze"
                className="mt-4 btn-primary text-xs py-2 px-3.5"
              >
                <ScanSearch className="h-3.5 w-3.5" />
                <span>Analyze Transaction</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
              <table className="w-full min-w-[520px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-3">ID</th>
                    <th className="pb-3 px-3">Type</th>
                    <th className="pb-3 px-3">Amount</th>
                    <th className="pb-3 px-3">Risk</th>
                    <th className="pb-3 pl-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {recentTransactions.map((tx) => {
                    const txId = tx.transaction_id || tx._id || tx.id;
                    return (
                      <tr
                        key={txId}
                        className="hover:bg-teal-50/20 transition-colors"
                      >
                        <td
                          className="py-3.5 pr-3 font-mono text-xs font-semibold text-navy whitespace-nowrap"
                          title={txId}
                        >
                          {shortId(txId)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-navy">
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-navy whitespace-nowrap tabular-nums">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <RiskBadge
                            level={tx.risk_level}
                            score={tx.risk_score}
                          />
                        </td>
                        <td className="py-3.5 pl-3 text-right text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDateTime(tx.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
