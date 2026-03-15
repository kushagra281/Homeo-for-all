import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import CategoryPage from "@/pages/category";
import MedicinePage from "@/pages/medicine";
import ModalitiesPage from "@/pages/modalities";
import DictionaryPage from "@/pages/dictionary";
import CommunityPage from "@/pages/community";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route path="/medicine" component={MedicinePage} />
      <Route path="/modalities" component={ModalitiesPage} />
      <Route path="/dictionary" component={DictionaryPage} />
      <Route path="/community" component={CommunityPage} />
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