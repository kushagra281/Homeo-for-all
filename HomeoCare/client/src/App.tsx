import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
const SymptomAnalysis = lazy(() => import("@/pages/symptom-analysis"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const PrivacyPage = lazy(() => import("@/pages/legal").then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("@/pages/legal").then(m => ({ default: m.TermsPage })));
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/error-boundary";
const ProfilePage = lazy(() => import("@/pages/profile"));
const Community = lazy(() => import("@/pages/community"));
const RepertoryPage = lazy(() => import("@/pages/repertory"));
function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-green-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/community" component={Community} />
      <Route path="/repertory" component={RepertoryPage} />
      <Route path="/symptom-analysis" component={SymptomAnalysis} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
