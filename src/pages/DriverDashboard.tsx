import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DriverTripInterface } from "@/components/tracking/DriverTripInterface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Bus, LogOut, User, MapPin, Users, Play, Clock, 
  CheckCircle, Navigation, Phone
} from "lucide-react";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function DriverDashboard() {
  const { driverAccount, isDriver, isSupervisor, signOut } = useDriverAuth();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const personName = isDriver 
    ? driverAccount?.driver?.full_name 
    : driverAccount?.supervisor?.full_name;

  // Fetch assigned routes
  const { data: assignedRoutes = [], isLoading } = useQuery({
    queryKey: ["driver-routes", driverAccount?.driver_id, driverAccount?.supervisor_id],
    queryFn: async () => {
      let query = supabase
        .from("routes")
        .select(`
          *,
          schools (name, city, latitude, longitude),
          drivers (full_name, phone),
          supervisors (full_name, phone),
          route_assignments (count)
        `)
        .eq("is_active", true);

      if (isDriver && driverAccount?.driver_id) {
        query = query.eq("driver_id", driverAccount.driver_id);
      } else if (isSupervisor && driverAccount?.supervisor_id) {
        query = query.eq("supervisor_id", driverAccount.supervisor_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(driverAccount?.driver_id || driverAccount?.supervisor_id),
  });

  // Check for active trips
  const { data: activeTrips = [] } = useQuery({
    queryKey: ["driver-active-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_trips")
        .select("*")
        .eq("status", "in_progress");
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Today's completed trips
  const { data: todayTrips = [] } = useQuery({
    queryKey: ["driver-today-trips"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const routeIds = assignedRoutes.map((r) => r.id);
      if (routeIds.length === 0) return [];

      const { data, error } = await supabase
        .from("live_trips")
        .select("*")
        .in("route_id", routeIds)
        .eq("status", "completed")
        .gte("created_at", today);
      if (error) throw error;
      return data;
    },
    enabled: assignedRoutes.length > 0,
  });

  const getActiveTrip = (routeId: string) => {
    return activeTrips.find((t) => t.route_id === routeId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bus className="h-8 w-8" />
            <div>
              <span className="text-xl font-bold">لوحة {isDriver ? "السائق" : "المشرف"}</span>
              <p className="text-sm text-blue-100">{personName}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-white/20"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 ml-2" />
            خروج
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">المسارات المعينة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {assignedRoutes.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">رحلات اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {todayTrips.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Trip Banner */}
        {activeTrips.length > 0 && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                    <Navigation className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-700 dark:text-green-300">رحلة نشطة</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      اضغط للمتابعة
                    </p>
                  </div>
                </div>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setSelectedRouteId(activeTrips[0].route_id)}
                >
                  متابعة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Routes List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">المسارات المعينة</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : assignedRoutes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>لا توجد مسارات معينة لك</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignedRoutes.map((route) => {
                const activeTrip = getActiveTrip(route.id);
                const studentCount = route.route_assignments?.[0]?.count || 0;

                return (
                  <Card 
                    key={route.id} 
                    className={`transition-all ${activeTrip ? "border-green-500 shadow-green-100" : ""}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bus className="h-5 w-5 text-primary" />
                          {route.name}
                        </CardTitle>
                        {activeTrip && (
                          <Badge className="bg-green-500">نشط</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {route.schools?.name}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {studentCount} طالب
                        </div>
                        {route.route_duration_minutes && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {route.route_duration_minutes} دقيقة
                          </div>
                        )}
                      </div>

                      {/* Show the other person (driver shows supervisor, supervisor shows driver) */}
                      {isDriver && route.supervisors && (
                        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{route.supervisors.full_name}</p>
                            <p className="text-xs text-muted-foreground">المشرفة</p>
                          </div>
                          <a href={`tel:${route.supervisors.phone}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Phone className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      )}
                      {isSupervisor && route.drivers && (
                        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{route.drivers.full_name}</p>
                            <p className="text-xs text-muted-foreground">السائق</p>
                          </div>
                          <a href={`tel:${route.drivers.phone}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Phone className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      )}

                      <Button
                        className="w-full gap-2"
                        variant={activeTrip ? "default" : "outline"}
                        onClick={() => setSelectedRouteId(route.id)}
                      >
                        {activeTrip ? (
                          <>
                            <Navigation className="h-4 w-4" />
                            متابعة الرحلة
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            بدء الرحلة
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Trip Interface Dialog */}
      <Dialog open={!!selectedRouteId} onOpenChange={() => setSelectedRouteId(null)}>
        <DialogContent className="max-w-4xl h-[95vh] p-0">
          {selectedRouteId && (
            <GoogleMapsProvider>
              <DriverTripInterface
                routeId={selectedRouteId}
                onClose={() => setSelectedRouteId(null)}
              />
            </GoogleMapsProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
