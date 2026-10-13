import axiosInstance from "./axiosInstance";

/**
 * Strip empty, null, or undefined values from query parameters object.
 *
 * @param {Object} params - Raw filter/pagination query params.
 * @returns {Object} Cleaned query params object.
 */
function cleanQueryParams(params = {}) {
  const cleaned = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

/**
 * Fetch paginated and filtered transaction records sorted by created_at descending.
 * Endpoint: GET /api/transactions (requires Authorization Bearer token).
 *
 * @param {Object} [params={}] - Pagination and filter query parameters.
 * @param {number} [params.page=1] - Page number (1-based index).
 * @param {number} [params.page_size=20] - Number of items per page (max 100).
 * @param {"Low"|"Medium"|"High"} [params.risk_level] - Filter by risk tier.
 * @param {"Potential Fraud"|"Likely Legitimate"} [params.prediction] - Filter by prediction label.
 * @param {string} [params.search] - Search by transaction_id substring.
 * @param {string} [params.date_from] - Filter transactions created on or after (ISO 8601 datetime).
 * @param {string} [params.date_to] - Filter transactions created on or before (ISO 8601 datetime).
 * @returns {Promise<Object>} PaginatedTransactions ({ items, total, page, page_size }).
 */
export async function getTransactions(params = {}, options = {}) {
  const response = await axiosInstance.get("/api/transactions", {
    params: cleanQueryParams(params),
    signal: options.signal,
  });
  return response.data;
}

/**
 * Retrieve a single transaction record by its transaction_id or MongoDB _id.
 * Endpoint: GET /api/transactions/{transaction_id} (requires Authorization Bearer token).
 *
 * @param {string} transactionId - Unique transaction_id (e.g. "TXN_...") or MongoDB ObjectId.
 * @returns {Promise<Object>} Full transaction record (TransactionOut schema).
 */
export async function getTransactionById(transactionId) {
  const response = await axiosInstance.get(
    `/api/transactions/${encodeURIComponent(transactionId)}`
  );
  return response.data;
}

/**
 * Fetch aggregate dashboard statistics for analyzed transactions.
 * Endpoint: GET /api/stats (requires Authorization Bearer token).
 *
 * @returns {Promise<Object>} TransactionStats ({ total_analyzed, potential_fraud_count, counts_per_risk_level, risk_level_counts, fraud_per_day }).
 */
export async function getStats() {
  const response = await axiosInstance.get("/api/stats");
  return response.data;
}

/**
 * Export filtered transactions as a downloadable CSV report file.
 * Endpoint: GET /api/report/export (requires Authorization Bearer token).
 *
 * @param {Object} [params={}] - Optional filter query parameters.
 * @param {"Low"|"Medium"|"High"} [params.risk_level] - Filter by risk tier.
 * @param {"Potential Fraud"|"Likely Legitimate"} [params.prediction] - Filter by prediction label.
 * @param {string} [params.search] - Search by transaction_id substring.
 * @param {string} [params.date_from] - Filter transactions created on or after (ISO 8601 datetime).
 * @param {string} [params.date_to] - Filter transactions created on or before (ISO 8601 datetime).
 * @param {boolean} [triggerDownload=true] - Whether to automatically trigger a browser file download.
 * @returns {Promise<Blob>} CSV file Blob.
 */
export async function exportReport(params = {}, triggerDownload = true) {
  const response = await axiosInstance.get("/api/report/export", {
    params: cleanQueryParams(params),
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });

  if (triggerDownload && typeof window !== "undefined") {
    const todayStr = new Date().toISOString().slice(0, 10);
    let filename = `fraudguard-report-${todayStr}.csv`;
    const disposition = response.headers?.["content-disposition"];
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return blob;
}

/**
 * Delete a transaction record (Admin only).
 * Endpoint: DELETE /api/transactions/{transaction_id} (requires Admin Authorization Bearer token).
 *
 * @param {string} transactionId - Unique transaction_id or MongoDB ObjectId to delete.
 * @returns {Promise<{ message: string, transaction_id: string }>} Deletion confirmation.
 */
export async function deleteTransaction(transactionId) {
  const response = await axiosInstance.delete(
    `/api/transactions/${encodeURIComponent(transactionId)}`
  );
  return response.data;
}
