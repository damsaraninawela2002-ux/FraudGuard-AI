import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Custom hook to access FraudGuard AI authentication state and actions.
 * Must be used within an <AuthProvider>.
 *
 * @returns {{
 *   user: Object | null,
 *   token: string | null,
 *   loading: boolean,
 *   isAuthenticated: boolean,
 *   login: Function,
 *   register: Function,
 *   logout: Function
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default useAuth;
