import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import NewsPage from "@/pages/NewsPage";
import Advisories from "@/pages/Advisories";
import ThreatIntel from "@/pages/ThreatIntel";
import Search from "@/pages/Search";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

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
        <Route path="/search" component={Search} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
