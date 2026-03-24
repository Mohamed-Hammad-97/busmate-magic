import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarState } from "@/contexts/SidebarContext";
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
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  GraduationCap,
  CalendarDays,
  FileText,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import seaterLogo from "@/assets/seater-logo.jpg";
import { CitySelector } from "./CitySelector";
import { EmployeeNotificationBell } from "./EmployeeNotificationBell";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Department = "customer_support" | "operations" | "operation_companies" | "finance" | "reports";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  department?: Department;
  adminOnly?: boolean;
  multiDepartment?: Department[];
}

interface NavGroup {
  type: 'group';
  label: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  department?: Department;
  multiDepartment?: Department[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => 'type' in entry && entry.type === 'group';

const navEntries: NavEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Homepage", href: "/homepage-admin", icon: Globe, adminOnly: true },
  { label: "Schools", href: "/schools", icon: School, department: "operations" },
  { label: "Registrations", href: "/registrations", icon: ClipboardList, department: "customer_support" },
  { label: "Customers", href: "/customers", icon: Users, department: "customer_support" },
  { label: "Routes", href: "/routes", icon: MapPin },
  { label: "Live Tracking", href: "/live-tracking", icon: Navigation },
  { label: "AI Route Planner", href: "/ai-routes", icon: Sparkles, department: "operations" },
  { label: "Drivers & Staff", href: "/staff", icon: Bus, department: "operations" },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Submissions", href: "/submissions", icon: MessageCircle, department: "customer_support" },
  { label: "Support Chat", href: "/support-chat", icon: MessageCircle, department: "customer_support" },
  {
    type: 'group',
    label: 'School Management',
    labelAr: 'إدارة المدارس',
    icon: GraduationCap,
    multiDepartment: ['operations', 'finance'],
    children: [
      { label: "Attendance", href: "/school-management?tab=attendance", icon: CalendarDays },
      { label: "Staff Files", href: "/school-management?tab=profiles", icon: FileText },
      { label: "Salaries", href: "/school-management?tab=salaries", icon: DollarSign, department: "finance" },
    ],
  },
  {
    type: 'group',
    label: 'Corporate Management',
    labelAr: 'إدارة الشركات',
    icon: Building2,
    multiDepartment: ['operation_companies', 'finance'],
    children: [
      { label: "Companies", href: "/corporate?tab=companies", icon: Building2 },
      { label: "Attendance", href: "/corporate?tab=attendance", icon: CalendarDays },
      { label: "Staff Files", href: "/corporate?tab=profiles", icon: FileText },
      { label: "Salaries", href: "/corporate?tab=salaries", icon: DollarSign, department: "finance" },
      { label: "Invoices", href: "/corporate?tab=invoices", icon: FileText, department: "finance" },
    ],
  },
  { label: "Reports", href: "/reports", icon: BarChart3, department: "reports" },
  { label: "Employees", href: "/employees", icon: UserCog, adminOnly: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  onMobileNavigate?: () => void;
}

export function Sidebar({ onMobileNavigate }: SidebarProps = {}) {
  const isMobileSheet = !!onMobileNavigate;
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { employee, isSuperAdmin, hasDepartment, signOut } = useAuth();
  const isRtl = i18n.language === 'ar';
  const { collapsed, toggle } = useSidebarState();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const effectiveCollapsed = isMobileSheet ? false : collapsed;

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const getNavLabel = (label: string) => {
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
      Submissions: t('nav.submissions', { defaultValue: isRtl ? 'الطلبات الواردة' : 'Submissions' }),
      'Support Chat': t('nav.supportChat'),
      Reports: t('nav.reports'),
      Homepage: 'Homepage',
      Employees: t('settings.employees'),
      Settings: t('nav.settings'),
      Attendance: t('schoolMgmt.attendance'),
      'Staff Files': t('schoolMgmt.staffFiles'),
      Salaries: t('schoolMgmt.salaries'),
      Companies: t('corporateMgmt.companies'),
      Invoices: t('corporateMgmt.invoices'),
      'School Management': t('schoolMgmt.title'),
      'Corporate Management': t('corporateMgmt.title'),
    };
    return labelMap[label] || label;
  };

  const canAccessItem = (item: { department?: Department; adminOnly?: boolean; multiDepartment?: Department[] }) => {
    if ('adminOnly' in item && item.adminOnly) return isSuperAdmin;
    if (item.multiDepartment) return item.multiDepartment.some(d => hasDepartment(d));
    if (item.department) return hasDepartment(item.department);
    return true;
  };

  const isItemActive = (href: string) => {
    const [path, query] = href.split('?');
    if (location.pathname !== path) return false;
    if (!query) return true;
    return location.search.includes(query);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.children.some(child => location.pathname === child.href.split('?')[0]);
  };

  const sidebarWidth = isMobileSheet ? 'w-full' : effectiveCollapsed ? 'w-[72px]' : 'w-64';

  const renderLink = (item: NavItem, indent = false) => {
    const isActive = isItemActive(item.href);
    const label = getNavLabel(item.label);

    const linkContent = (
      <Link
        key={item.href}
        to={item.href}
        onClick={onMobileNavigate}
        className={cn(
          "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
          effectiveCollapsed ? "justify-center h-10 w-full" : "gap-3 px-3 py-2",
          indent && !effectiveCollapsed && "pr-3 pl-9 rtl:pl-3 rtl:pr-9",
          isActive
            ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm shadow-primary/10"
            : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )}
      >
        {isActive && (
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary",
            isRtl ? "right-0" : "left-0",
            effectiveCollapsed && (isRtl ? "-right-0.5" : "-left-0.5")
          )} />
        )}
        <item.icon className={cn(
          "shrink-0 transition-colors",
          effectiveCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
        )} />
        {!effectiveCollapsed && (
          <span className="truncate text-[13px]">{label}</span>
        )}
      </Link>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent
            side={isRtl ? "left" : "right"}
            className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
          >
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const renderGroup = (group: NavGroup) => {
    const isExpanded = expandedGroups[group.label] ?? isGroupActive(group);
    const groupLabel = getNavLabel(group.label);
    const visibleChildren = group.children.filter(canAccessItem);

    if (visibleChildren.length === 0) return null;

    if (effectiveCollapsed) {
      // When collapsed, show first child's icon as tooltip trigger with group name
      return (
        <Tooltip key={group.label}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                // Navigate to first child
                const firstHref = visibleChildren[0].href;
                window.location.href = firstHref;
              }}
              className={cn(
                "group relative flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 h-10 w-full",
                isGroupActive(group)
                  ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm shadow-primary/10"
                  : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <group.icon className={cn(
                "shrink-0 transition-colors h-5 w-5",
                isGroupActive(group) ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
              )} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side={isRtl ? "left" : "right"}
            className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
          >
            {groupLabel}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={group.label} className="space-y-0.5">
        <button
          onClick={() => toggleGroup(group.label)}
          className={cn(
            "w-full group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
            isGroupActive(group)
              ? "text-primary"
              : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <group.icon className={cn(
            "shrink-0 transition-colors h-[18px] w-[18px]",
            isGroupActive(group) ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
          )} />
          <span className="truncate flex-1 text-start">{groupLabel}</span>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 transition-transform duration-200 shrink-0",
            isExpanded && "rotate-180"
          )} />
        </button>
        {isExpanded && (
          <div className="space-y-0.5">
            {visibleChildren.map(child => renderLink(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          isMobileSheet
            ? "h-full bg-sidebar"
            : "fixed top-0 z-40 h-screen bg-sidebar border-sidebar-border transition-all duration-300 ease-in-out",
          sidebarWidth,
          !isMobileSheet && (isRtl ? 'right-0 border-l' : 'left-0 border-r')
        )}
      >
        <div className="flex h-full flex-col relative">
          {/* Collapse toggle */}
          {!isMobileSheet && (
            <button
              onClick={toggle}
              className={cn(
                "absolute top-[18px] z-50 flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shadow-md",
                isRtl ? '-left-3.5' : '-right-3.5'
              )}
            >
              {effectiveCollapsed
                ? (isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                : (isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />)
              }
            </button>
          )}

          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border shrink-0 transition-all duration-300",
            effectiveCollapsed ? "justify-center px-2" : "gap-3 px-5"
          )}>
            <div className="relative">
              <img
                src={seaterLogo}
                alt="Seater"
                className="h-9 w-9 rounded-lg object-cover ring-2 ring-sidebar-accent/50 shadow-lg"
              />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar-background" />
            </div>
            {!effectiveCollapsed && (
              <div className="overflow-hidden">
                <span className="text-lg font-extrabold text-sidebar-foreground tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Seater</span>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto sidebar-scroll">
            <nav className={cn("space-y-0.5 py-4", effectiveCollapsed ? "px-2" : "px-3")}>
              {navEntries.map(entry => {
                if (isGroup(entry)) {
                  if (!canAccessItem(entry)) return null;
                  return renderGroup(entry);
                }
                if (!canAccessItem(entry)) return null;
                return renderLink(entry);
              })}
            </nav>

            {/* City Selector */}
            {!effectiveCollapsed && (
              <div className="px-3 py-2 border-t border-sidebar-border/50 flex items-center justify-between">
                <CitySelector />
                <EmployeeNotificationBell />
              </div>
            )}
            {effectiveCollapsed && (
              <div className="px-2 py-2 border-t border-sidebar-border/50 flex justify-center">
                <EmployeeNotificationBell />
              </div>
            )}

            {/* User section */}
            <div className={cn(
              "border-t border-sidebar-border/50",
              effectiveCollapsed ? "p-2" : "p-3"
            )}>
              {!effectiveCollapsed && (
                <div className="mb-2 px-3 py-2 rounded-xl bg-sidebar-accent/40">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">
                    {employee?.full_name || "User"}
                  </p>
                  <p className="text-[11px] text-sidebar-muted truncate">
                    {employee?.email}
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
                    side={isRtl ? "left" : "right"}
                    className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg"
                  >
                    {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-colors rounded-xl"
                  onClick={signOut}
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
