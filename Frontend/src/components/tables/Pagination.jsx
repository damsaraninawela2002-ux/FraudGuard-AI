import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "../../utils/format";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Build page number array with ellipsis ("...") for compact pagination controls.
 */
function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];

  if (currentPage > 3) {
    pages.push("ellipsis-start");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis-end");
  }

  pages.push(totalPages);
  return pages;
}

export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  const pageNumbers = buildPageNumbers(safePage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
      {/* Left: Showing X-Y of Z + Page Size Select */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4 text-xs sm:text-sm text-slate-600">
        <span className="tabular-nums">
          Showing{" "}
          <span className="font-semibold text-navy">
            {formatNumber(startIndex)}–{formatNumber(endIndex)}
          </span>{" "}
          of <span className="font-semibold text-navy">{formatNumber(total)}</span>
        </span>

        <div className="flex items-center gap-2">
          <label
            htmlFor="pagination-page-size"
            className="text-xs text-slate-500"
          >
            Rows per page:
          </label>
          <select
            id="pagination-page-size"
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:opacity-60 transition"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Previous / Page Numbers with Ellipsis / Next */}
      <div className="flex items-center justify-center sm:justify-end gap-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={disabled || safePage <= 1}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((item) => {
            if (typeof item === "string") {
              return (
                <span
                  key={item}
                  className="px-2 py-1 text-xs font-medium text-slate-400 select-none"
                >
                  &hellip;
                </span>
              );
            }

            const isCurrent = item === safePage;
            return (
              <button
                key={item}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2.5 text-xs font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 cursor-pointer ${
                  isCurrent
                    ? "bg-teal text-white shadow-xs"
                    : "border border-slate-200 bg-white text-navy hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={disabled || safePage >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
