import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, ErrorBoundary, RouteErrorBoundary } from "@/components/Common";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/context/SessionContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// ── Lazy-loaded pages ─────────────────────────────────────────────────────
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NewsPage = lazy(() => import("@/pages/NewsPage"));
const Advisories = lazy(() => import("@/pages/Advisories"));
const CertInAdvisories = lazy(() => import("@/pages/CertInAdvisories"));
const ThreatIntel = lazy(() => import("@/pages/ThreatIntel"));
const Search = lazy(() => import("@/pages/Search"));
const Settings = lazy(() => import("@/pages/Settings"));
const PatchTracker = lazy(() => import("@/pages/PatchTracker"));
const Bookmarks = lazy(() => import("@/pages/Bookmarks"));
const Workspaces = lazy(() => import("@/pages/Workspaces"));
const NotFound = lazy(() => import("@/pages/not-found"));

// ── Auth pages (public, no AppLayout) ────────────────────────────────────
const SignIn = lazy(() => import("@/pages/auth/SignIn"));
const SignUp = lazy(() => import("@/pages/auth/SignUp"));
const VerifyEmail = lazy(() => import("@/pages/auth/VerifyEmail"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

// ── Onboarding + billing ──────────────────────────────────────────────────
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const BillingSettings = lazy(() => import("@/pages/settings/BillingSettings"));

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && "status" in error) {
    const status = (error as Error & { status: number }).status;
    return status >= 500;
  }
  return false;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
    },
  },
});

const PageLoader = (
  <div className="flex justify-center py-20">
    <Loader size="lg" />
  </div>
);

function AppRoutes() {
  return (
    <AppLayout>
      <Suspense fallback={PageLoader}>
        <RouteErrorBoundary>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/news/local">
              {() => <NewsPage scope="local" />}
            </Route>
            <Route path="/news/global">
              {() => <NewsPage scope="global" />}
            </Route>
            <Route path="/cert-in" component={CertInAdvisories} />
            <Route path="/advisories" component={Advisories} />
            <Route path="/patches" component={PatchTracker} />
            <Route path="/threat-intel" component={ThreatIntel} />
            <Route path="/search" component={Search} />
            <Route path="/bookmarks">
              {() => (
                <ProtectedRoute>
                  <Bookmarks />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/workspaces" component={Workspaces} />
            <Route path="/settings" component={Settings} />
            <Route path="/settings/billing">
              {() => (
                <ProtectedRoute>
                  <BillingSettings />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/onboarding">
              {() => (
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              )}
            </Route>
            <Route component={NotFound} />
          </Switch>
        </RouteErrorBoundary>
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public auth routes — rendered outside AppLayout */}
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Everything else goes through AppLayout */}
      <Route>{() => <AppRoutes />}</Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="cyfy-theme">
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SessionProvider>
              <Suspense fallback={PageLoader}>
                <RouteErrorBoundary>
                  <Router />
                </RouteErrorBoundary>
              </Suspense>
            </SessionProvider>
          </WouterRouter>
          <Toaster position="bottom-right" />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
