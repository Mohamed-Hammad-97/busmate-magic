import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ParentAuthProvider } from "@/contexts/ParentAuthContext";
import { CityProvider } from "@/contexts/CityContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import Registrations from "./pages/Registrations";
import Register from "./pages/Register";
import Customers from "./pages/Customers";
import RoutesPage from "./pages/Routes";
import AIRoutes from "./pages/AIRoutes";
import LiveTracking from "./pages/LiveTracking";
import Payments from "./pages/Payments";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ParentAuth from "./pages/ParentAuth";
import ParentDashboard from "./pages/ParentDashboard";

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
          
          {/* Parent Portal routes */}
          <Route path="/parent/*" element={
            <ParentAuthProvider>
              <Routes>
                <Route path="/auth" element={<ParentAuth />} />
                <Route path="/" element={<ParentProtectedRoute><ParentDashboard /></ParentProtectedRoute>} />
                <Route path="*" element={<Navigate to="/parent" replace />} />
              </Routes>
            </ParentAuthProvider>
          } />
          
          {/* Employee Auth-wrapped routes */}
          <Route path="/*" element={
            <AuthProvider>
              <CityProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/schools" element={<ProtectedRoute><Schools /></ProtectedRoute>} />
                <Route path="/registrations" element={<ProtectedRoute><Registrations /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
                <Route path="/live-tracking" element={<ProtectedRoute><LiveTracking /></ProtectedRoute>} />
                <Route path="/ai-routes" element={<ProtectedRoute><AIRoutes /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </CityProvider>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;