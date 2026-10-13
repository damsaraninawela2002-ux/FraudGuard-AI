import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Route guard component that protects authenticated routes.
 * Displays a centered teal spinner while restoring session state,
 * redirects unauthenticated visitors to `/login` while preserving their
 * intended destination in `location.state.from`, and renders `<Outlet />`
 * when authenticated.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
        <div
          className="h-10 w-10 rounded-full border-4 border-teal/30 border-t-teal animate-spin"
          role="status"
          aria-label="Loading session"
        />
        <p className="mt-3 text-sm font-medium text-navy/70">
          Verifying session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}
