import axiosInstance from "./axiosInstance";

function normalizeTransactionPayload(payload) {
  return {
    amount: Number(payload.amount),
    transaction_type: String(payload.transaction_type).trim().toUpperCase(),
    hour_of_day: Number(payload.hour_of_day),
    old_balance_origin: Number(payload.old_balance_origin),
    new_balance_origin: Number(payload.new_balance_origin),
    old_balance_dest: Number(payload.old_balance_dest),
    new_balance_dest: Number(payload.new_balance_dest),
  };
}

/**
 * Evaluate a financial transaction for fraud risk and generate SHAP feature explanations.
 * Endpoint: POST /api/predict (requires Authorization Bearer token, persists to MongoDB).
 *
 * @param {Object} payload - Transaction features (TransactionInput schema).
 * @returns {Promise<Object>} PredictionResult ({ transaction_id, prediction, risk_score, risk_level, top_features, recommendation, saved, created_at }).
 */
export async function predictTransaction(payload) {
  const requestBody = normalizeTransactionPayload(payload);
  const response = await axiosInstance.post("/api/predict", requestBody);
  return response.data;
}

/**
 * Simulate a hypothetical financial transaction in the What-If Sandbox without saving to MongoDB.
 * Endpoint: POST /api/simulate (requires Authorization Bearer token, never writes to DB).
 *
 * @param {Object} payload - Transaction features (TransactionInput schema).
 * @param {Object} [options] - Optional Axios request config (e.g. { signal } from AbortController).
 * @returns {Promise<Object>} PredictionResult ({ transaction_id: null, prediction, risk_score, risk_level, top_features, recommendation, saved: false, created_at }).
 */
export async function simulateTransaction(payload, options = {}) {
  const requestBody = normalizeTransactionPayload(payload);
  const response = await axiosInstance.post("/api/simulate", requestBody, options);
  return response.data;
}
