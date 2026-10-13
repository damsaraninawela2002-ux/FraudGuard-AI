import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { exportReport } from "../api/transactionsApi";
import {
  buildBackendQueryParams,
  useTransactions,
} from "../hooks/useTransactions";
import TransactionFilters from "../components/tables/TransactionFilters";
import TransactionsTable from "../components/tables/TransactionsTable";
import Pagination from "../components/tables/Pagination";
import TransactionDetailsModal from "../components/tables/TransactionDetailsModal";
import { handleApiError } from "../utils/handleApiError";

const VALID_PAGE_SIZES = [10, 25, 50];

export default function TransactionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters, pagination, and sort state from URL search params
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const rawPageSize = parseInt(searchParams.get("page_size") || "10", 10);
  const pageSize = VALID_PAGE_SIZES.includes(rawPageSize) ? rawPageSize : 10;

  const search = searchParams.get("search") || "";
  const riskLevel = searchParams.get("risk_level") || "";
  const prediction = searchParams.get("prediction") || "";
  const type = searchParams.get("type") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const { items, total, loading, error, refetch } = useTransactions({
    page,
    pageSize,
    search,
    riskLevel,
    prediction,
    type,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  });

  const hasActiveFilters = Boolean(
    search.trim() || riskLevel || prediction || type || dateFrom || dateTo
  );

  // Helper to update URL query params cleanly (stripping default/empty keys)
  const updateParams = useCallback(
    (updates) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, val]) => {
            if (
              val === undefined ||
              val === null ||
              val === "" ||
              (key === "page" && Number(val) === 1) ||
              (key === "page_size" && Number(val) === 10) ||
              (key === "sort_by" && val === "created_at") ||
              (key === "sort_order" && val === "desc")
            ) {
              next.delete(key);
            } else {
              next.set(key, String(val));
            }
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Update filters and reset to page 1
  const handleFilterChange = useCallback(
    (partialFilters) => {
      const mapped = { page: 1 };
      if ("search" in partialFilters) mapped.search = partialFilters.search;
      if ("riskLevel" in partialFilters)
        mapped.risk_level = partialFilters.riskLevel;
      if ("prediction" in partialFilters)
        mapped.prediction = partialFilters.prediction;
      if ("type" in partialFilters) mapped.type = partialFilters.type;
      if ("dateFrom" in partialFilters)
        mapped.date_from = partialFilters.dateFrom;
      if ("dateTo" in partialFilters) mapped.date_to = partialFilters.dateTo;

      updateParams(mapped);
    },
    [updateParams]
  );

  const handleResetFilters = useCallback(() => {
    updateParams({
      page: 1,
      search: "",
      risk_level: "",
      prediction: "",
      type: "",
      date_from: "",
      date_to: "",
    });
  }, [updateParams]);

  const handlePageChange = useCallback(
    (nextPage) => {
      updateParams({ page: nextPage });
    },
    [updateParams]
  );

  const handlePageSizeChange = useCallback(
    (nextPageSize) => {
      updateParams({ page: 1, page_size: nextPageSize });
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (nextSortBy, nextSortOrder) => {
      updateParams({
        sort_by: nextSortBy,
        sort_order: nextSortOrder,
      });
    },
    [updateParams]
  );

  const handleExportCsv = async () => {
    setExporting(true);
    setExportError("");

    try {
      const backendParams = buildBackendQueryParams({
        page,
        pageSize,
        search,
        riskLevel,
        prediction,
        dateFrom,
        dateTo,
      });

      await exportReport(
        {
          search: backendParams.search,
          risk_level: backendParams.risk_level,
          prediction: backendParams.prediction,
          date_from: backendParams.date_from,
          date_to: backendParams.date_to,
        },
        true
      );
    } catch (err) {
      setExportError(
        handleApiError(err, "Failed to export CSV report. Please try again.")
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            Transaction History
          </h1>
          <p className="page-subtitle">
            Review every analyzed transaction, inspect SHAP drivers, and export audit trails.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            aria-label="Export transactions as CSV"
            className="btn-primary"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </>
            )}
          </button>

          {exportError && (
            <p role="alert" className="text-xs font-medium text-risk-high">
              {exportError}
            </p>
          )}
        </div>
      </div>

      {/* Fetch Error Banner */}
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
            className="btn-danger text-xs px-3 py-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Filter Bar Card */}
      <TransactionFilters
        filters={{
          search,
          riskLevel,
          prediction,
          type,
          dateFrom,
          dateTo,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Transactions Table & Pagination Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <TransactionsTable
          items={items}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onSelectTransaction={(tx) => setSelectedTransaction(tx)}
          onResetFilters={handleResetFilters}
        />

        <Pagination
          page={page}
          pageSize={pageSize}
          total={type ? items.length : total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          disabled={loading}
        />
      </div>

      {/* Row Click Details Modal */}
      <TransactionDetailsModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}
