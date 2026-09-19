import { Navigate, useLocation } from "react-router-dom";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { Loader2 } from "lucide-react";

interface DriverProtectedRouteProps {
  children: React.ReactNode;
}

export function DriverProtectedRoute({ children }: DriverProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useDriverAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/driver/login" replace state={{ returnTo }} />;
  }

  return <>{children}</>;
}
