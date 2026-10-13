import axiosInstance from "./axiosInstance";

/**
 * Retrieve evaluation metrics for the trained fraud detection model on the held-out test set.
 * Endpoint: GET /api/model/metrics (requires Authorization Bearer token).
 *
 * @returns {Promise<Object>} ModelMetricsResponse ({ model_name, precision, recall, f1_score, pr_auc, roc_auc, confusion_matrix: { tn, fp, fn, tp }, threshold, trained_at }).
 */
export async function getModelMetrics() {
  const response = await axiosInstance.get("/api/model/metrics");
  return response.data;
}
