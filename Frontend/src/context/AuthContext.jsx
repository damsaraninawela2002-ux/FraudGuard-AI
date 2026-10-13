import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from "../api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Restore and validate session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (isMounted) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
          setToken(storedToken);
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Authenticate with email and password, store JWT and user profile.
   *
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<Object>} Authenticated user profile
   */
  const login = useCallback(async (credentials) => {
    const tokenData = await loginUser({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    const accessToken = tokenData.access_token;
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);

    try {
      const currentUser = await getCurrentUser();
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setToken(null);
      setUser(null);
      throw err;
    }
  }, []);

  /**
   * Register a new user account (`POST /api/auth/register`), then automatically
   * log the user in (`POST /api/auth/login` + `GET /api/auth/me`) since the
   * registration endpoint returns `UserOut` without a token.
   *
   * @param {{ full_name: string, email: string, password: string }} data
   * @returns {Promise<Object>} Authenticated user profile
   */
  const register = useCallback(
    async (data) => {
      await registerUser({
        full_name: data.full_name.trim(),
        email: data.email.trim(),
        password: data.password,
      });

      return await login({
        email: data.email.trim(),
        password: data.password,
      });
    },
    [login]
  );

  /**
   * Clear authentication state and localStorage credentials.
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [user, token, loading, isAuthenticated, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
