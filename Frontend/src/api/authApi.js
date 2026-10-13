import axiosInstance from "./axiosInstance";

/**
 * Register a new user account.
 * Endpoint: POST /api/auth/register
 *
 * @param {Object} data - User registration payload (UserCreate schema).
 * @param {string} data.email - Valid email address.
 * @param {string} data.password - Password (minimum 8 characters).
 * @param {string} data.full_name - Full name of the user/analyst.
 * @returns {Promise<Object>} Registered user profile (UserOut: { _id, email, full_name, role, created_at }).
 */
export async function registerUser(data) {
  const response = await axiosInstance.post("/api/auth/register", {
    email: data.email,
    password: data.password,
    full_name: data.full_name,
  });
  return response.data;
}

/**
 * Authenticate an existing user and obtain a signed JWT access token.
 * Endpoint: POST /api/auth/login (expects JSON body matching UserLogin schema).
 *
 * @param {Object} data - User login credentials (UserLogin schema).
 * @param {string} data.email - Registered email address.
 * @param {string} data.password - Account password.
 * @returns {Promise<{ access_token: string, token_type: string }>} JWT token response (Token schema).
 */
export async function loginUser(data) {
  const response = await axiosInstance.post("/api/auth/login", {
    email: data.email,
    password: data.password,
  });
  return response.data;
}

/**
 * Retrieve the profile of the currently authenticated user.
 * Endpoint: GET /api/auth/me (requires Authorization Bearer token).
 *
 * @returns {Promise<Object>} Authenticated user profile (UserOut: { _id, email, full_name, role, created_at }).
 */
export async function getCurrentUser() {
  const response = await axiosInstance.get("/api/auth/me");
  return response.data;
}
