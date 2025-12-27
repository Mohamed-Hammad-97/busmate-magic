import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import Registrations from "./pages/Registrations";
import Register from "./pages/Register";
import Customers from "./pages/Customers";
import RoutesPage from "./pages/Routes";
import AIRoutes from "./pages/AIRoutes";
import Payments from "./pages/Payments";
import Staff from "./pages/Staff";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path="/register" element={<Register />} />
          
          {/* Auth-wrapped routes */}
          <Route path="/*" element={
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/schools" element={<ProtectedRoute><Schools /></ProtectedRoute>} />
                <Route path="/registrations" element={<ProtectedRoute><Registrations /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
                <Route path="/ai-routes" element={<ProtectedRoute><AIRoutes /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;