import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCompanyAuth } from "@/contexts/CompanyAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Building2, LogOut, Truck, FileText, Users, Navigation,
  User, Shield, MessageCircle, LayoutDashboard,
  ChevronLeft, ChevronRight, Settings, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import seaterLogo from "@/assets/seater-logo.jpg";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
  { label: "Lines", value: "lines", icon: Truck },
  { label: "Live Tracking", value: "tracking", icon: Navigation },
  { label: "Drivers & Staff", value: "drivers", icon: User },
  { label: "Staff Files", value: "staff-profiles", icon: CreditCard },
  { label: "Invoices", value: "invoices", icon: FileText },
  { label: "Employees", value: "employees", icon: Users },
  { label: "Chat", value: "chat", icon: MessageCircle },
  { label: "Accounts", value: "accounts", icon: Shield, adminOnly: true },
  { label: "Settings", value: "settings", icon: Settings },
];

interface CompanyPortalSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMobileNavigate?: () => void;
}

export function CompanyPortalSidebar({ activeTab, onTabChange, onMobileNavigate }: CompanyPortalSidebarProps) {
  const { account, signOut } = useCompanyAuth();
  const isMobileSheet = !!onMobileNavigate;
  const [collapsed, setCollapsed] = useState(false);

  const effectiveCollapsed = isMobileSheet ? false : collapsed;
  const sidebarWidth = isMobileSheet ? "w-full" : effectiveCollapsed ? "w-[72px]" : "w-64";

  const handleItemClick = (value: string) => {
    onTabChange(value);
    onMobileNavigate?.();
  };

  const renderLink = (item: NavItem) => {
    if (item.adminOnly && account?.role !== "admin") return null;
    const isActive = activeTab === item.value;

    const linkContent = (
      <button
        key={item.value}
        onClick={() => handleItemClick(item.value)}
        className={cn(
          "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 w-full",
          effectiveCollapsed ? "justify-center h-10" : "gap-3 px-3 py-2",
          isActive
            ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm shadow-primary/10"
            : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )}
      >
        {isActive && (
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
        )}
        <item.icon className={cn(
          "shrink-0 transition-colors",
          effectiveCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
        )} />
        {!effectiveCollapsed && (
          <span className="truncate text-[13px]">{item.label}</span>
        )}
      </button>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.value}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
          >
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          isMobileSheet
            ? "h-full bg-sidebar"
            : "fixed top-0 left-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          sidebarWidth
        )}
      >
        <div className="flex h-full flex-col relative">
          {/* Collapse toggle */}
          {!isMobileSheet && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute top-[18px] -right-3.5 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shadow-md"
            >
              {effectiveCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border shrink-0 transition-all duration-300",
            effectiveCollapsed ? "justify-center px-2" : "gap-3 px-5"
          )}>
            <div className="relative">
              {account?.company_logo_url ? (
                <img
                  src={account.company_logo_url}
                  alt={account.company_name || "Company"}
                  className="h-9 w-9 rounded-lg object-cover ring-2 ring-sidebar-accent/50 shadow-lg"
                />
              ) : (
                <img
                  src={seaterLogo}
                  alt="Seater"
                  className="h-9 w-9 rounded-lg object-cover ring-2 ring-sidebar-accent/50 shadow-lg"
                />
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar-background" />
            </div>
            {!effectiveCollapsed && (
              <div className="overflow-hidden">
                <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                  {account?.company_name || "Seater"}
                </span>
                <p className="text-[10px] text-sidebar-muted font-medium uppercase tracking-widest">Company Portal</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <nav className={cn("space-y-0.5 py-4", effectiveCollapsed ? "px-2" : "px-3")}>
              {navItems.map(renderLink)}
            </nav>

            {/* User section */}
            <div className={cn(
              "border-t border-sidebar-border/50",
              effectiveCollapsed ? "p-2" : "p-3"
            )}>
              {!effectiveCollapsed && (
                <div className="mb-2 px-3 py-2 rounded-xl bg-sidebar-accent/40">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">
                    {account?.full_name || "User"}
                  </p>
                  <p className="text-[11px] text-sidebar-muted truncate">
                    {account?.company_name}
                  </p>
                </div>
              )}

              {effectiveCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full h-10 text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-colors rounded-xl"
                      onClick={signOut}
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
                  >
                    Sign Out
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-colors rounded-xl"
                  onClick={signOut}
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
