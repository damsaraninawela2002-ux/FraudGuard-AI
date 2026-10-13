export default function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-navy tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
