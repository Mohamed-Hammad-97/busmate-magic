import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OperationsMapView } from "@/components/tracking/OperationsMapView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, Map, List } from "lucide-react";
import { useCity } from "@/contexts/CityContext";

export default function LiveTracking() {
  const { selectedCity } = useCity();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["routes-for-tracking", selectedCity],
    queryFn: async () => {
      let query = supabase
        .from("routes")
        .select(`
          *,
          schools (name, city),
          drivers (full_name),
          supervisors (full_name),
          route_assignments (count)
        `)
        .eq("is_active", true);

      if (selectedCity !== "all") {
        query = query.eq("schools.city", selectedCity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Check for active trips
  const { data: activeTrips = [] } = useQuery({
    queryKey: ["active-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_trips")
        .select("route_id")
        .eq("status", "in_progress");
      if (error) throw error;
      return data.map((t) => t.route_id);
    },
    refetchInterval: 10000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">التتبع المباشر</h1>
          <p className="text-muted-foreground">إدارة الرحلات وتتبع الباصات</p>
        </div>

        <Tabs defaultValue="map" className="space-y-4">
          <TabsList>
            <TabsTrigger value="map" className="gap-2">
              <Map className="h-4 w-4" />
              خريطة الباصات
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <List className="h-4 w-4" />
              قائمة المسارات
            </TabsTrigger>
          </TabsList>

          {/* Map View - All buses */}
          <TabsContent value="map">
            <OperationsMapView />
          </TabsContent>

          {/* Routes List View - View Only for Admin */}
          <TabsContent value="routes">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => {
                const isActive = activeTrips.includes(route.id);
                const studentCount = route.route_assignments?.[0]?.count || 0;

                return (
                  <Card key={route.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{route.name}</CardTitle>
                        {isActive && (
                          <Badge className="bg-green-500">Active / نشط</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {route.schools?.name}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {studentCount} Students / طالب
                      </div>
                      {route.drivers && (
                        <div className="text-sm text-muted-foreground">
                          Driver / السائق: {route.drivers.full_name}
                        </div>
                      )}
                      {route.supervisors && (
                        <div className="text-sm text-muted-foreground">
                          Supervisor / المشرف: {route.supervisors.full_name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={route.car_type === 'ac' ? 'default' : 'secondary'}>
                          {route.car_type === 'ac' ? 'AC / مكيف' : 'Non-AC / بدون تكييف'}
                        </Badge>
                        <Badge variant="outline">
                          {route.max_seats} Seats / مقعد
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
