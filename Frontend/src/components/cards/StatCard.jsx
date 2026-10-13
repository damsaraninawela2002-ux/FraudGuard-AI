import { isValidElement } from "react";

const ACCENT_STYLES = {
  navy: {
    border: "border-l-navy",
    iconBg: "bg-gradient-to-br from-navy/15 to-navy/5 text-navy border border-navy/15",
  },
  teal: {
    border: "border-l-teal",
    iconBg: "bg-gradient-to-br from-teal/20 to-teal/5 text-teal border border-teal/25",
  },
  low: {
    border: "border-l-risk-low",
    iconBg: "bg-gradient-to-br from-risk-low/20 to-risk-low/5 text-risk-low border border-risk-low/25",
  },
  "risk-low": {
    border: "border-l-risk-low",
    iconBg: "bg-gradient-to-br from-risk-low/20 to-risk-low/5 text-risk-low border border-risk-low/25",
  },
  medium: {
    border: "border-l-risk-medium",
    iconBg: "bg-gradient-to-br from-risk-medium/20 to-risk-medium/5 text-risk-medium border border-risk-medium/25",
  },
  "risk-medium": {
    border: "border-l-risk-medium",
    iconBg: "bg-gradient-to-br from-risk-medium/20 to-risk-medium/5 text-risk-medium border border-risk-medium/25",
  },
  high: {
    border: "border-l-risk-high",
    iconBg: "bg-gradient-to-br from-risk-high/20 to-risk-high/5 text-risk-high border border-risk-high/25",
  },
  "risk-high": {
    border: "border-l-risk-high",
    iconBg: "bg-gradient-to-br from-risk-high/20 to-risk-high/5 text-risk-high border border-risk-high/25",
  },
};

export default function StatCard({
  title,
  label,
  value,
  subtitle,
  icon: IconProp,
  accent = "navy",
  loading = false,
}) {
  const heading = title || label || "";
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.navy;

  const renderIcon = () => {
    if (!IconProp) return null;
    if (isValidElement(IconProp)) {
      return IconProp;
    }
    const IconComponent = IconProp;
    return <IconComponent className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 border-l-4 ${styles.border} bg-white p-5 sm:p-6 shadow-sm animate-pulse`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-3.5 w-28 rounded-md bg-slate-200" />
            <div className="h-7 w-20 rounded-md bg-slate-200" />
            <div className="h-3 w-36 rounded-md bg-slate-100" />
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-100 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 border-l-4 ${styles.border} bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
            {heading}
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-navy tracking-tight tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>

        {IconProp && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-2xs ${styles.iconBg}`}
          >
            {renderIcon()}
          </div>
        )}
      </div>
    </div>
  );
}
