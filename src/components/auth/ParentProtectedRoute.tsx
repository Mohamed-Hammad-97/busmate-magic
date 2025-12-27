import { Navigate, useLocation } from "react-router-dom";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Loader2 } from "lucide-react";

interface ParentProtectedRouteProps {
  children: React.ReactNode;
}

export function ParentProtectedRoute({ children }: ParentProtectedRouteProps) {
  const { user, parentAccount, isLoading } = useParentAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/parent/auth" state={{ from: location }} replace />;
  }

  if (!parentAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">لم يتم العثور على حساب</h2>
          <p className="text-muted-foreground">
            رقم الهاتف غير مسجل في النظام. يرجى التسجيل أولاً.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
