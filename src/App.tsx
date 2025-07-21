import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FirestoreProvider } from "@/contexts/FirestoreContext";
import Index from "./pages/Index";
import { Dashboard } from "./pages/Dashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { HallOfFame } from "./pages/HallOfFame";
import { LandingPage } from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import MyReserved from './pages/MyReserved';
import "./App.css";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <FirestoreProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/hall-of-fame" element={<HallOfFame />} />
              <Route path="/my-reserved" element={<MyReserved />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </FirestoreProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
