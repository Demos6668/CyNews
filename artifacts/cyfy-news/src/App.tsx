import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader } from "@/components/Common";
import Dashboard from "@/pages/Dashboard";
import NewsPage from "@/pages/NewsPage";
import Advisories from "@/pages/Advisories";
import ThreatIntel from "@/pages/ThreatIntel";
import NotFound from "@/pages/not-found";

const Search = lazy(() => import("@/pages/Search"));
const Settings = lazy(() => import("@/pages/Settings"));

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
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/news/local">
          {() => <NewsPage scope="local" />}
        </Route>
        <Route path="/news/global">
          {() => <NewsPage scope="global" />}
        </Route>
        <Route path="/advisories" component={Advisories} />
        <Route path="/threat-intel" component={ThreatIntel} />
        <Route path="/search">
          {() => (
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <Loader size="lg" />
                </div>
              }
            >
              <Search />
            </Suspense>
          )}
        </Route>
        <Route path="/settings">
          {() => (
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <Loader size="lg" />
                </div>
              }
            >
              <Settings />
            </Suspense>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="cyfy-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
