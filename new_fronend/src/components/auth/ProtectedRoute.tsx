import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required roles to access this route (any match is sufficient). */
  roles?: string[];
  /** Where to redirect if not authenticated (default: /login). */
  redirectTo?: string;
}

/**
 * Wraps a route so it is only accessible to authenticated users.
 * While auth is loading, renders nothing (avoids flicker).
 */
export default function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6C63FF] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0) {
    const allowed = roles.some((r) => hasRole(r));
    if (!allowed) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-destructive">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
