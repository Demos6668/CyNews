/**
 * Protected route wrapper.
 *
 * Redirects to /sign-in when the user is not authenticated.
 * Shows a loading spinner while the session is being resolved.
 *
 * Usage:
 *   <Route path="/settings">
 *     {() => <ProtectedRoute><Settings /></ProtectedRoute>}
 *   </Route>
 */

import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { useSessionContext } from "@/context/SessionContext";
import { Loader } from "@/components/Common";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Redirect target — defaults to /sign-in */
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  redirectTo = "/sign-in",
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useSessionContext();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Use replace-style navigation to avoid polluting history
    setLocation(redirectTo, { replace: true });
    return null;
  }

  return <>{children}</>;
}
