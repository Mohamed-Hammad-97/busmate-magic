import { Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  { label: "AI Route Planner", href: "/ai-routes", icon: Sparkles, department: "operations" },
  { label: "Drivers & Staff", href: "/staff", icon: Bus, department: "operations" },
  { label: "Payments", href: "/payments", icon: CreditCard, department: "finance" },
  { label: "Reports", href: "/reports", icon: BarChart3, department: "reports" },
  { label: "Employees", href: "/employees", icon: UserCog, adminOnly: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { employee, isSuperAdmin, hasDepartment, signOut } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly) return isSuperAdmin;
    if (item.department) return hasDepartment(item.department);
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Bus className="h-8 w-8 text-sidebar-primary" />
          <span className="text-lg font-semibold text-sidebar-foreground">
            BusTrack
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
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
                {item.label}
              </Link>
            );
          })}
        </nav>

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
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  );
}