import { Navigate, useLocation } from "react-router-dom";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { Loader2 } from "lucide-react";

export function CompanyProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useCompanyAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/company/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
