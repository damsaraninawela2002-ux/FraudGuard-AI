import { useCallback, useEffect, useState } from "react";
import { getModelMetrics } from "../api/modelApi";
import { handleApiError } from "../utils/handleApiError";

/**
 * Custom hook to fetch trained model evaluation metrics (`GET /api/model/metrics`).
 *
 * @returns {{
 *   metrics: Object | null,
 *   loading: boolean,
 *   error: string,
 *   refetch: () => Promise<void>
 * }}
 */
export function useModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getModelMetrics();
      setMetrics(data || null);
    } catch (err) {
      setError(
        handleApiError(
          err,
          "Failed to load model evaluation metrics. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}

export default useModelMetrics;
