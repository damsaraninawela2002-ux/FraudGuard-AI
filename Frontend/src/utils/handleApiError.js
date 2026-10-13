/**
 * Parse an Axios / FastAPI error into a clean, user-friendly message string.
 *
 * Handles:
 * - FastAPI `detail` as a plain string
 * - FastAPI/Pydantic `detail` as a validation error array (HTTP 422)
 * - Request timeouts (`ECONNABORTED`)
 * - Network / connection errors (only when `error.response` is absent)
 * - Database unavailability (HTTP 503)
 * - Standard HTTP status codes (401, 403, 404, 409, 422, 500, 503)
 *
 * @param {any} error - The error object caught from an Axios request.
 * @param {string} [fallbackMessage="An unexpected error occurred. Please try again."] - Fallback message if no specific detail can be extracted.
 * @returns {string} User-friendly error message.
 */
export function handleApiError(
  error,
  fallbackMessage = "An unexpected error occurred. Please try again."
) {
  if (!error) {
    return fallbackMessage;
  }

  // 1. Handle request timeout
  if (
    error.code === "ECONNABORTED" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("timeout"))
  ) {
    return "The request timed out. Please check your connection and try again.";
  }

  // 2. Handle real network error (strictly when no HTTP response was received from the backend)
  if (!error.response) {
    if (error.code === "ERR_NETWORK" || error.request) {
      return "Unable to reach the server. Please ensure the backend service is running.";
    }
    return error.message || fallbackMessage;
  }

  const { status, data } = error.response;
  const detail = data?.detail;

  // 3. FastAPI `detail` as a plain string
  if (typeof detail === "string" && detail.trim().length > 0) {
    if (
      status === 503 &&
      detail.toLowerCase().includes("database unreachable")
    ) {
      return "The database is currently unavailable. Please try again later.";
    }
    return detail;
  }

  // 4. FastAPI / Pydantic `detail` as an array of validation errors (422 Unprocessable Entity)
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((err) => {
        if (typeof err === "string") return err;
        const fieldPath = Array.isArray(err.loc)
          ? err.loc.filter((part) => part !== "body" && part !== "query").join(".")
          : "";
        const msg = err.msg || "Invalid value";
        return fieldPath ? `${fieldPath}: ${msg}` : msg;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  // 5. FastAPI `detail` or response `message` as an object
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.msg === "string") return detail.msg;
  }
  if (typeof data?.message === "string" && data.message.trim().length > 0) {
    return data.message;
  }

  // 6. Status-code specific fallbacks
  switch (status) {
    case 401:
      return "Invalid credentials or session expired. Please log in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "A conflict occurred (e.g. email already registered).";
    case 422:
      return "Invalid input provided. Please check your form fields.";
    case 500:
      return "An internal server error occurred. Please try again later.";
    case 503:
      return "The database is currently unavailable. Please try again later.";
    default:
      return fallbackMessage;
  }
}

export default handleApiError;
