import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, ErrorBoundary, RouteErrorBoundary } from "@/components/Common";
import { Toaster } from "@/components/ui/sonner";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NewsPage = lazy(() => import("@/pages/NewsPage"));
const Advisories = lazy(() => import("@/pages/Advisories"));
const CertInAdvisories = lazy(() => import("@/pages/CertInAdvisories"));
const ThreatIntel = lazy(() => import("@/pages/ThreatIntel"));
const Search = lazy(() => import("@/pages/Search"));
const Settings = lazy(() => import("@/pages/Settings"));
const PatchTracker = lazy(() => import("@/pages/PatchTracker"));
const Bookmarks = lazy(() => import("@/pages/Bookmarks"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader size="lg" />
          </div>
        }
      >
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
            <Route path="/bookmarks" component={Bookmarks} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </RouteErrorBoundary>
      </Suspense>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="cyfy-theme">
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster position="bottom-right" />

        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
