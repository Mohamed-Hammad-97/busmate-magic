import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DriverTripInterface } from "@/components/tracking/DriverTripInterface";
import { OperationsMapView } from "@/components/tracking/OperationsMapView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bus, MapPin, Users, Play, Map, List } from "lucide-react";
import { useCity } from "@/contexts/CityContext";

export default function LiveTracking() {
  const { selectedCity } = useCity();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

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

          {/* Routes List View */}
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
                          <Badge className="bg-green-500">نشط</Badge>
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
                        {studentCount} طالب
                      </div>
                      {route.drivers && (
                        <div className="text-sm text-muted-foreground">
                          السائق: {route.drivers.full_name}
                        </div>
                      )}
                      <Button
                        className="w-full gap-2"
                        variant={isActive ? "default" : "outline"}
                        onClick={() => setSelectedRouteId(route.id)}
                      >
                        {isActive ? <Bus className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {isActive ? "متابعة الرحلة" : "بدء الرحلة"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedRouteId} onOpenChange={() => setSelectedRouteId(null)}>
          <DialogContent className="max-w-4xl h-[90vh] p-0">
            {selectedRouteId && (
              <DriverTripInterface
                routeId={selectedRouteId}
                onClose={() => setSelectedRouteId(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
