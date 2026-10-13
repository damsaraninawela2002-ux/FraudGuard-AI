import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTransactions } from "../api/transactionsApi";
import { handleApiError } from "../utils/handleApiError";

/**
 * Normalize UI prediction filter value ("Legitimate" | "Potential Fraud")
 * to the exact string stored in MongoDB ("Likely Legitimate" | "Potential Fraud").
 */
export function toBackendPredictionFilter(prediction) {
  if (!prediction || prediction === "All") return undefined;
  if (prediction === "Legitimate" || prediction === "Likely Legitimate") {
    return "Likely Legitimate";
  }
  if (prediction === "Potential Fraud") {
    return "Potential Fraud";
  }
  return prediction;
}

/**
 * Format YYYY-MM-DD date inputs into full UTC ISO bounds for backend filtering.
 */
export function buildBackendQueryParams({
  page = 1,
  pageSize = 10,
  search = "",
  riskLevel = "",
  prediction = "",
  dateFrom = "",
  dateTo = "",
}) {
  return {
    page: Number(page) || 1,
    page_size: Number(pageSize) || 10,
    search: search ? search.trim() : undefined,
    risk_level: riskLevel && riskLevel !== "All" ? riskLevel : undefined,
    prediction: toBackendPredictionFilter(prediction),
    date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
    date_to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
  };
}

/**
 * Custom hook for fetching, filtering, and sorting paginated transaction records.
 *
 * - Backend handles: `page`, `page_size`, `search`, `risk_level`, `prediction`, `date_from`, `date_to`
 * - Client-side (current page) handles: `type` (`transaction_type`) and `sortBy` / `sortOrder`
 *   because `GET /api/transactions` in `routes_transactions.py` does not accept `transaction_type`
 *   or dynamic sort parameters.
 */
export function useTransactions({
  page = 1,
  pageSize = 10,
  search = "",
  riskLevel = "",
  prediction = "",
  type = "",
  dateFrom = "",
  dateTo = "",
  sortBy = "created_at",
  sortOrder = "desc",
} = {}) {
  const [rawItems, setRawItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestCounterRef = useRef(0);
  const abortControllerRef = useRef(null);

  const fetchTransactions = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentRequestId = ++requestCounterRef.current;
    setLoading(true);
    setError("");

    try {
      const queryParams = buildBackendQueryParams({
        page,
        pageSize,
        search,
        riskLevel,
        prediction,
        dateFrom,
        dateTo,
      });

      const data = await getTransactions(queryParams, {
        signal: controller.signal,
      });

      // Ignore if a newer request has started
      if (currentRequestId !== requestCounterRef.current) {
        return;
      }

      setRawItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      // Ignore canceled requests
      if (
        err?.name === "CanceledError" ||
        err?.code === "ERR_CANCELED" ||
        controller.signal.aborted ||
        currentRequestId !== requestCounterRef.current
      ) {
        return;
      }

      setError(
        handleApiError(
          err,
          "Failed to load transaction history. Please try again."
        )
      );
    } finally {
      if (currentRequestId === requestCounterRef.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, search, riskLevel, prediction, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTransactions]);

  // Apply client-side transaction_type filter and column sorting on the current page
  const items = useMemo(() => {
    let result = [...rawItems];

    // 1. Client-side filter by transaction_type (not supported by backend query params)
    if (type && type !== "All") {
      const normalizedType = type.trim().toUpperCase();
      result = result.filter(
        (tx) =>
          String(tx.transaction_type || "")
            .trim()
            .toUpperCase() === normalizedType
      );
    }

    // 2. Client-side sorting on the current page (Date, Amount, Risk score)
    if (sortBy) {
      const dir = sortOrder === "asc" ? 1 : -1;
      result.sort((a, b) => {
        if (sortBy === "amount") {
          return ((Number(a.amount) || 0) - (Number(b.amount) || 0)) * dir;
        }
        if (sortBy === "risk_score") {
          return (
            ((Number(a.risk_score) || 0) - (Number(b.risk_score) || 0)) * dir
          );
        }
        // Default: created_at
        const timeA = new Date(a.created_at || 0).getTime() || 0;
        const timeB = new Date(b.created_at || 0).getTime() || 0;
        return (timeA - timeB) * dir;
      });
    }

    return result;
  }, [rawItems, type, sortBy, sortOrder]);

  return {
    items,
    total,
    loading,
    error,
    refetch: fetchTransactions,
  };
}

export default useTransactions;
