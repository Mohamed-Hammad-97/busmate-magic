import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-background relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Premium background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-accent/[0.02] rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      </div>
      <Sidebar />
      <main className={`relative z-10 ${isRtl ? 'pr-64' : 'pl-64'}`}>
        <div className="p-8">
          {(title || description) && (
            <div className="mb-8">
              {title && (
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              )}
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}