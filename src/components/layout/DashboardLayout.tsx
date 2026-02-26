import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { useSidebarState } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import seaterLogo from "@/assets/seater-logo.jpg";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { collapsed } = useSidebarState();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainPadding = isMobile
    ? ''
    : collapsed
      ? (isRtl ? 'pr-[72px]' : 'pl-[72px]')
      : (isRtl ? 'pr-64' : 'pl-64');

  return (
    <div className="min-h-screen bg-background relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Premium background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-accent/[0.02] rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRtl ? "right" : "left"} className="p-0 w-[280px] border-0">
                  <Sidebar onMobileNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2">
                <img src={seaterLogo} alt="Seater" className="h-8 w-8 rounded-lg object-cover" />
                <span className="font-bold text-foreground">Seater</span>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={`relative z-10 transition-all duration-300 ${mainPadding}`}>
        <div className={isMobile ? "p-4" : "p-8"}>
          {(title || description) && (
            <div className="mb-6 md:mb-8">
              {title && (
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
              )}
              {description && (
                <p className="text-muted-foreground mt-1 text-sm md:text-base">{description}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
