import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Bus,
  School,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface DashboardStats {
  totalStudents: number;
  totalSchools: number;
  activeRoutes: number;
  pendingPayments: number;
  pendingRegistrations: number;
  totalDrivers: number;
}

const cityMapping: Record<string, string[]> = {
  cairo: ['cairo', 'القاهرة', 'قاهرة', 'Cairo'],
  giza: ['giza', 'الجيزة', 'جيزة', 'Giza'],
  alexandria: ['alexandria', 'الإسكندرية', 'اسكندرية', 'إسكندرية', 'Alexandria'],
};

export default function Dashboard() {
  const { employee, hasDepartment, isSuperAdmin } = useAuth();
  const { selectedCity } = useCity();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalSchools: 0,
    activeRoutes: 0,
    pendingPayments: 0,
    pendingRegistrations: 0,
    totalDrivers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all data to filter client-side by city
        const [
          { data: registrations },
          { data: schools },
          { data: routes },
          { data: pendingPaymentsData },
          { data: pendingRegsData },
          { data: driversData },
        ] = await Promise.all([
          supabase.from("registrations").select("id, school_id, status, schools!inner(city)"),
          supabase.from("schools").select("id, city, is_active").eq("is_active", true),
          supabase.from("routes").select("id, school_id, is_active, schools!inner(city)").eq("is_active", true),
          supabase.from("payments").select("id, status").eq("status", "pending"),
          supabase.from("registrations").select("id, school_id, status, schools!inner(city)").eq("status", "pending_fees"),
          supabase.from("drivers").select("id, city, is_active").eq("is_active", true),
        ]);

        const cityNames = selectedCity !== 'all' ? (cityMapping[selectedCity] || []) : [];
        const matchesCity = (city: string | null) => {
          if (cityNames.length === 0) return true;
          const c = (city || "").toLowerCase();
          return cityNames.some((name) => c.includes(name.toLowerCase()));
        };

        const filteredStudents = selectedCity === 'all' ? (registrations || []) :
          (registrations || []).filter((r: any) => matchesCity(r.schools?.city));
        const filteredSchools = selectedCity === 'all' ? (schools || []) :
          (schools || []).filter((s: any) => matchesCity(s.city));
        const filteredRoutes = selectedCity === 'all' ? (routes || []) :
          (routes || []).filter((r: any) => matchesCity(r.schools?.city));
        const filteredPendingRegs = selectedCity === 'all' ? (pendingRegsData || []) :
          (pendingRegsData || []).filter((r: any) => matchesCity(r.schools?.city));
        const filteredDrivers = selectedCity === 'all' ? (driversData || []) :
          (driversData || []).filter((d: any) => matchesCity(d.city));

        setStats({
          totalStudents: filteredStudents.length,
          totalSchools: filteredSchools.length,
          activeRoutes: filteredRoutes.length,
          pendingPayments: pendingPaymentsData?.length || 0,
          pendingRegistrations: filteredPendingRegs.length,
          totalDrivers: filteredDrivers.length,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [selectedCity]);

  const statCards = [
    {
      title: "Total Students",
      value: stats.totalStudents,
      icon: Users,
      color: "text-primary",
      show: true,
    },
    {
      title: "Active Schools",
      value: stats.totalSchools,
      icon: School,
      color: "text-info",
      show: hasDepartment("operations") || isSuperAdmin,
    },
    {
      title: "Active Routes",
      value: stats.activeRoutes,
      icon: Bus,
      color: "text-success",
      show: hasDepartment("operations") || isSuperAdmin,
    },
    {
      title: "Active Drivers",
      value: stats.totalDrivers,
      icon: TrendingUp,
      color: "text-warning",
      show: hasDepartment("operations") || isSuperAdmin,
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments,
      icon: CreditCard,
      color: "text-destructive",
      show: hasDepartment("finance") || isSuperAdmin,
    },
    {
      title: "Pending Registrations",
      value: stats.pendingRegistrations,
      icon: Clock,
      color: "text-warning",
      show: hasDepartment("customer_support") || isSuperAdmin,
    },
  ];

  const visibleCards = statCards.filter((card) => card.show);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHero
          icon={TrendingUp}
          title={`Welcome, ${employee?.full_name || "User"}`}
          description="Here's an overview of your transportation system"
          stats={[
            { icon: Users, value: stats.totalStudents, label: 'Students' },
            { icon: School, value: stats.totalSchools, label: 'Schools' },
            { icon: Bus, value: stats.activeRoutes, label: 'Routes' },
          ]}
        />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCards.map((card) => (
          <Card key={card.title} className="animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hasDepartment("customer_support") && (
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">New Registration</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Register a new student
                  </p>
                </div>
              </CardHeader>
            </Card>
          )}
          
          {hasDepartment("operations") && (
            <>
              <Card className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 rounded-lg bg-success/10">
                    <Bus className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Generate Routes</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      AI-powered route optimization
                    </p>
                  </div>
                </CardHeader>
              </Card>
              
              <Card className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 rounded-lg bg-info/10">
                    <School className="h-6 w-6 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Add School</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Register a new school
                    </p>
                  </div>
                </CardHeader>
              </Card>
            </>
          )}
          
          {hasDepartment("finance") && (
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-warning/10">
                  <CreditCard className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-base">Record Payment</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Process student payments
                  </p>
                </div>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>

      {/* Status Overview */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database</span>
                <span className="text-sm font-medium text-success">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auth Service</span>
                <span className="text-sm font-medium text-success">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Maps API</span>
                <span className="text-sm font-medium text-success">Connected</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-4">
              No recent alerts
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}