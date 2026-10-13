import axiosInstance from "./axiosInstance";

/**
 * Check backend application status and whether ML services are running in demo mode.
 * Endpoint: GET /health (public).
 *
 * @returns {Promise<{ status: string, is_demo: boolean }>} Application health status.
 */
export async function getHealth() {
  const response = await axiosInstance.get("/health");
  return response.data;
}

/**
 * Check MongoDB database connectivity.
 * Endpoint: GET /health/db (public).
 *
 * @returns {Promise<{ status: string, database: string }>} Database connectivity status.
 */
export async function getHealthDb() {
  const response = await axiosInstance.get("/health/db");
  return response.data;
}
