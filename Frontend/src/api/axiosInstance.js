import axios from "axios";

export const TOKEN_STORAGE_KEY = "fraudguard_token";
export const USER_STORAGE_KEY = "fraudguard_user";

/**
 * Configured Axios instance for communicating with the FraudGuard AI FastAPI backend.
 * Reads base URL from VITE_API_BASE_URL environment variable.
 */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Request Interceptor:
 * Automatically attaches the JWT Bearer token from localStorage (`fraudguard_token`)
 * to the Authorization header of outgoing requests if available.
 */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * On HTTP 401 Unauthorized responses, clears stored authentication credentials
 * (`fraudguard_token` and `fraudguard_user`) and redirects the browser to `/login`
 * unless the user is already on the `/login` page.
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // TEMP debug
    console.log(
      "[Axios Error]",
      error.message,
      error.code,
      error.response?.status
    );

    if (error.response && error.response.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);

      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
