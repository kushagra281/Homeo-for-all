import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
const SymptomAnalysis = lazy(() => import("@/pages/symptom-analysis"));
const PotencyGuidePage = lazy(() => import("@/pages/potency-guide-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
import NotFound from "@/pages/not-found";
const ProfilePage = lazy(() => import("@/pages/profile"));
const DictionaryPage = lazy(() => import("@/pages/dictionary"));
const Community = lazy(() => import("@/pages/community"));
const RepertoryPage = lazy(() => import("@/pages/repertory"));
function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-green-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/dictionary" component={DictionaryPage} />
      <Route path="/community" component={Community} />
      <Route path="/repertory" component={RepertoryPage} />
      <Route path="/symptom-analysis" component={SymptomAnalysis} />
      <Route path="/potency-guide" component={PotencyGuidePage} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
