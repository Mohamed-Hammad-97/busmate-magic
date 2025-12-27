import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bus,
  Users,
  School,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Home,
  MapPin,
  UserCog,
  ClipboardList,
  Sparkles,
  Navigation,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import seaterLogo from "@/assets/seater-logo.jpg";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CitySelector } from "./CitySelector";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  department?: "customer_support" | "operations" | "finance" | "reports";
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Schools", href: "/schools", icon: School, department: "operations" },
  { label: "Registrations", href: "/registrations", icon: ClipboardList, department: "customer_support" },
  { label: "Customers", href: "/customers", icon: Users, department: "customer_support" },
  { label: "Routes", href: "/routes", icon: MapPin, department: "operations" },
  { label: "Live Tracking", href: "/live-tracking", icon: Navigation, department: "operations" },
  { label: "AI Route Planner", href: "/ai-routes", icon: Sparkles, department: "operations" },
  { label: "Drivers & Staff", href: "/staff", icon: Bus, department: "operations" },
  { label: "Payments", href: "/payments", icon: CreditCard, department: "finance" },
  { label: "Support Chat", href: "/support-chat", icon: MessageCircle, department: "customer_support" },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Employees", href: "/employees", icon: UserCog, adminOnly: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { employee, isSuperAdmin, hasDepartment, signOut } = useAuth();
  const isRtl = i18n.language === 'ar';

  const getNavLabel = (item: NavItem) => {
    const labelMap: Record<string, string> = {
      Dashboard: t('nav.dashboard'),
      Schools: t('nav.schools'),
      Registrations: t('nav.registrations'),
      Customers: t('nav.customers'),
      Routes: t('nav.routes'),
      'Live Tracking': t('nav.liveTracking'),
      'AI Route Planner': t('nav.aiRoutes'),
      'Drivers & Staff': t('nav.staff'),
      Payments: t('nav.payments'),
      'Support Chat': t('nav.supportChat'),
      Reports: t('nav.reports'),
      Employees: t('settings.employees'),
      Settings: t('nav.settings'),
    };
    return labelMap[item.label] || item.label;
  };

  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly) return isSuperAdmin;
    if (item.department) return hasDepartment(item.department);
    return true;
  });

  return (
    <aside className={`fixed top-0 z-40 h-screen w-64 bg-sidebar border-sidebar-border ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}`}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <img src={seaterLogo} alt="Seater" className="h-10 w-10 rounded-lg object-cover" />
          <span className="text-lg font-semibold text-sidebar-foreground">
            Seater
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {getNavLabel(item)}
              </Link>
            );
          })}
        </nav>

        {/* City Selector */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          <CitySelector />
        </div>

        {/* Language Switcher */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          <LanguageSwitcher />
        </div>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {employee?.full_name || "User"}
            </p>
            <p className="text-xs text-sidebar-muted truncate">
              {employee?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </aside>
  );
}