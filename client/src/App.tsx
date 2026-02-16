import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { PageLoader } from "@/components/ui/loading-spinner";

import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

// Protected Route Wrapper
function Router() {
  const { user, isLoading } = useAuth();
  
  // Handle root redirect based on auth status
  const RootRedirect = () => {
    const [, setLocation] = useLocation();

    useEffect(() => {
      if (!isLoading) {
        if (user) {
          setLocation("/dashboard");
        } else {
          setLocation("/auth");
        }
      }
    }, [user, isLoading, setLocation]);

    return <PageLoader />;
  };

  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) return <PageLoader />;

  return <Component />;
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
