import { useCallback, useEffect, useState } from "react";
import { getStats, getTransactions } from "../api/transactionsApi";
import { handleApiError } from "../utils/handleApiError";

const DEFAULT_RECENT_LIMIT = 50;

/**
 * Custom hook to load Dashboard aggregate statistics (`GET /api/stats`)
 * and recent transactions (`GET /api/transactions?page=1&page_size=50`) in parallel.
 *
 * @returns {{
 *   stats: Object | null,
 *   transactions: Array<Object>,
 *   loading: boolean,
 *   error: string,
 *   refetch: () => Promise<void>
 * }}
 */
export function useDashboardData() {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [statsData, txResponse] = await Promise.all([
        getStats(),
        getTransactions({ page: 1, page_size: DEFAULT_RECENT_LIMIT }),
      ]);

      setStats(statsData || null);
      setTransactions(Array.isArray(txResponse?.items) ? txResponse.items : []);
    } catch (err) {
      setError(
        handleApiError(
          err,
          "Failed to load dashboard metrics. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    transactions,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}

export default useDashboardData;
