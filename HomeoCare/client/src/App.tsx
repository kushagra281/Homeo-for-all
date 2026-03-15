import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Remedies from "@/pages/remedies";
import SymptomAnalysis from "@/pages/symptom-analysis";
import PotencyGuidePage from "@/pages/potency-guide-page";
import DiagnosticWizardPage from "@/pages/diagnostic-wizard-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/remedies/:category" component={Remedies} />
      <Route path="/symptom-analysis" component={SymptomAnalysis} />
      <Route path="/potency-guide" component={PotencyGuidePage} />
      <Route path="/diagnostic/:bodySystem" component={DiagnosticWizardPage} />
      <Route component={NotFound} />
    </Switch>
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
