import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import BrandVoice from "./pages/BrandVoice";
import AdminDashboard from "./pages/AdminDashboard";
import Settings from "./pages/Settings";
import SignInPage from "./pages/SignIn";
import PricingPage from "./pages/Pricing";
import FreeTrial from "./pages/FreeTrial";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/brand-voice" component={BrandVoice} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/signin" component={SignInPage} />
      {/* Hidden pricing page — accessed via settings gear in sidebar */}
      <Route path="/pricing" component={PricingPage} />
      <Route path="/free-trial" component={FreeTrial} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
