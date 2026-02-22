import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OperationsMapView } from "@/components/tracking/OperationsMapView";
import { TripHistory } from "@/components/tracking/TripHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Map, List, History, Bus, ChevronLeft } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { PageHero } from "@/components/layout/PageHero";

export default function LiveTracking() {
  const { t } = useTranslation();
  const { selectedCity } = useCity();
  const [historyRouteId, setHistoryRouteId] = useState<string | null>(null);

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
        <PageHero
          icon={MapPin}
          title={t('liveTracking.title')}
          description={t('liveTracking.description')}
          stats={[
            { icon: Bus, value: routes.length, label: 'Routes' },
            { icon: MapPin, value: activeTrips.length, label: 'Active Trips' },
          ]}
        />

        <Tabs defaultValue="map" className="space-y-4">
          <TabsList>
            <TabsTrigger value="map" className="gap-2">
              <Map className="h-4 w-4" />
              {t('liveTracking.busMap')}
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <List className="h-4 w-4" />
              {t('liveTracking.routesList')}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              سجل الرحلات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <GoogleMapsProvider>
              <OperationsMapView />
            </GoogleMapsProvider>
          </TabsContent>

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
                          <Badge className="bg-green-500">{t('liveTracking.active')}</Badge>
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
                        {studentCount} {t('liveTracking.students')}
                      </div>
                      {route.drivers && (
                        <div className="text-sm text-muted-foreground">
                          {t('liveTracking.driver')}: {route.drivers.full_name}
                        </div>
                      )}
                      {route.supervisors && (
                        <div className="text-sm text-muted-foreground">
                          {t('liveTracking.supervisor')}: {route.supervisors.full_name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={route.car_type === 'ac' ? 'default' : 'secondary'}>
                          {route.car_type === 'ac' ? t('liveTracking.ac') : t('liveTracking.nonAc')}
                        </Badge>
                        <Badge variant="outline">
                          {route.max_seats} {t('liveTracking.seats')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="history">
            {!historyRouteId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">اختر مسار لعرض سجل رحلاته:</p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {routes.map(route => (
                    <Card
                      key={route.id}
                      className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
                      onClick={() => setHistoryRouteId(route.id)}
                    >
                      <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bus className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{route.name}</p>
                            <p className="text-xs text-muted-foreground">{route.schools?.name}</p>
                          </div>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Button variant="ghost" size="sm" className="mb-3" onClick={() => setHistoryRouteId(null)}>
                  ← العودة للمسارات
                </Button>
                <TripHistory
                  routeId={historyRouteId}
                  routeName={routes.find(r => r.id === historyRouteId)?.name}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
