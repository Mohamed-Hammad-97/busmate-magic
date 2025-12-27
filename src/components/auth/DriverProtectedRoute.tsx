import { Navigate } from "react-router-dom";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { Loader2 } from "lucide-react";

interface DriverProtectedRouteProps {
  children: React.ReactNode;
}

export function DriverProtectedRoute({ children }: DriverProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useDriverAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" replace />;
  }

  return <>{children}</>;
}
