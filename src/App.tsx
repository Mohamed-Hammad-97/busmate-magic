import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ParentAuthProvider } from "@/contexts/ParentAuthContext";
import { DriverAuthProvider } from "@/contexts/DriverAuthContext";
import { CityProvider } from "@/contexts/CityContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import { DriverProtectedRoute } from "@/components/auth/DriverProtectedRoute";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import Registrations from "./pages/Registrations";
import Register from "./pages/Register";
import RegisterStudent from "./pages/RegisterStudent";
import RegisterCorporate from "./pages/RegisterCorporate";
import RegisterPrivate from "./pages/RegisterPrivate";
import ServiceDetails from "./pages/ServiceDetails";
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
import DriverAuth from "./pages/DriverAuth";
import DriverDashboard from "./pages/DriverDashboard";
import SupportChat from "./pages/SupportChat";
import HomepageAdmin from "./pages/HomepageAdmin";
import Submissions from "./pages/Submissions";
import Corporate from "./pages/Corporate";
import SchoolManagement from "./pages/SchoolManagement";
const queryClient = new QueryClient();

// Component to handle RTL direction globally
const DirectionManager = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  
  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DirectionManager>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/student" element={<RegisterStudent />} />
          <Route path="/register/corporate" element={<RegisterCorporate />} />
          <Route path="/register/private" element={<RegisterPrivate />} />
          <Route path="/services/:serviceType" element={<ServiceDetails />} />
          
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

          {/* Driver/Supervisor Portal routes */}
          <Route path="/driver/*" element={
            <DriverAuthProvider>
              <Routes>
                <Route path="/login" element={<DriverAuth />} />
                <Route path="/" element={<DriverProtectedRoute><DriverDashboard /></DriverProtectedRoute>} />
                <Route path="*" element={<Navigate to="/driver" replace />} />
              </Routes>
            </DriverAuthProvider>
          } />
          
          {/* Employee Auth-wrapped routes */}
          <Route path="/*" element={
            <AuthProvider>
              <SidebarProvider>
              <CityProvider>
              <Routes>
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
                <Route path="/support-chat" element={<ProtectedRoute><SupportChat /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/homepage-admin" element={<ProtectedRoute><HomepageAdmin /></ProtectedRoute>} />
                <Route path="/submissions" element={<ProtectedRoute><Submissions /></ProtectedRoute>} />
                <Route path="/corporate" element={<ProtectedRoute requireDepartment="operation_companies"><Corporate /></ProtectedRoute>} />
                <Route path="/school-management" element={<ProtectedRoute><SchoolManagement /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </CityProvider>
              </SidebarProvider>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </DirectionManager>
  </QueryClientProvider>
);

export default App;