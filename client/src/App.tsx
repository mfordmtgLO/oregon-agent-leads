import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import AppLayout from "./components/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { StateProvider } from "./contexts/StateContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AddAgent from "./pages/AddAgent";
import Dashboard from "./pages/Dashboard";
import OfficeRankings from "./pages/OfficeRankings";
import ReviewQueue from "./pages/ReviewQueue";
import Pairings from "./pages/Pairings";
import BigPurpleDotSetup from "./pages/BigPurpleDotSetup";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path={"/"} component={Dashboard} />
        <Route path={"/offices"} component={OfficeRankings} />
        <Route path={"/review"} component={ReviewQueue} />
        <Route path={"/pairings"} component={Pairings} />
        <Route path={"/big-purple-dot"} component={BigPurpleDotSetup} />
        <Route path={"/add"} component={AddAgent} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <StateProvider>
            <Router />
          </StateProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
