import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireDepartment?: "customer_support" | "operations" | "operation_companies" | "finance" | "reports";
}

export function ProtectedRoute({
  children,
  requireAdmin,
  requireDepartment,
}: ProtectedRouteProps) {
  const { user, isLoading, isEmployee, isSuperAdmin, hasDepartment } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isEmployee) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireDepartment && !hasDepartment(requireDepartment)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}