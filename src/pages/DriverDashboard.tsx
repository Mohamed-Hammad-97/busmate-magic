import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DriverTripInterface } from "@/components/tracking/DriverTripInterface";
import { TripHistory } from "@/components/tracking/TripHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bus, LogOut, User, MapPin, Users, Play, Clock,
  CheckCircle, Navigation, Phone, History, Shield, UserCircle, MessageCircle,
} from "lucide-react";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import seaterLogo from "@/assets/seater-logo.jpg";
import { DriverChatSection } from "@/components/chat/DriverChatSection";

export default function DriverDashboard() {
  const { t } = useTranslation();
  const { driverAccount, isDriver, isSupervisor, signOut } = useDriverAuth();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [historyRouteId, setHistoryRouteId] = useState<string | null>(null);

  const personName = isDriver
    ? driverAccount?.driver?.full_name
    : driverAccount?.supervisor?.full_name;

  const { data: assignedRoutes = [], isLoading } = useQuery({
    queryKey: ["driver-routes", driverAccount?.driver_id, driverAccount?.supervisor_id],
    queryFn: async () => {
      let query = supabase
        .from("routes")
        .select(`*, schools (name, city, latitude, longitude), drivers (full_name, phone), supervisors (full_name, phone), route_assignments (count)`)
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

  const { data: activeTrips = [] } = useQuery({
    queryKey: ["driver-active-trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_trips").select("*").eq("status", "in_progress");
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: todayTrips = [] } = useQuery({
    queryKey: ["driver-today-trips"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const routeIds = assignedRoutes.map((r) => r.id);
      if (routeIds.length === 0) return [];
      const { data, error } = await supabase.from("live_trips").select("*").in("route_id", routeIds).eq("status", "completed").gte("created_at", today);
      if (error) throw error;
      return data;
    },
    enabled: assignedRoutes.length > 0,
  });

  const getActiveTrip = (routeId: string) => activeTrips.find((t) => t.route_id === routeId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={seaterLogo} alt="Seater" className="h-10 w-10 rounded-xl shadow-md" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Seater</h1>
              <p className="text-xs text-muted-foreground">
                {isDriver ? t('driverPortal.driverPortalLabel') : t('driverPortal.supervisorPortalLabel')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium">{personName}</p>
              <p className="text-xs text-muted-foreground">{driverAccount?.phone}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="h-4 w-4 ml-1" />
              {t('driverPortal.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Profile Card */}
        <Card className="overflow-hidden border-0 shadow-xl rounded-2xl">
          <div className="h-28 bg-gradient-to-r from-blue-600 via-blue-500 to-primary rounded-t-2xl" />
          <CardContent className="relative -mt-9 pb-5 px-5">
            <div className="flex items-end gap-4">
              <div className="h-[72px] w-[72px] rounded-2xl bg-background border-4 border-background shadow-xl flex items-center justify-center shrink-0">
                {isDriver ? <Bus className="h-10 w-10 text-primary" /> : <Shield className="h-10 w-10 text-primary" />}
              </div>
              <div className="pb-0.5 min-w-0">
                <h2 className="text-xl font-bold truncate">{personName}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {driverAccount?.phone}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-medium">
                      {isDriver ? t('driverPortal.driverLabel') : t('driverPortal.supervisorLabel')}
                    </Badge>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-4 pb-3 px-3 text-center">
              <MapPin className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-2xl font-bold text-primary">{assignedRoutes.length}</div>
              <p className="text-xs text-muted-foreground">{t('driverPortal.routesCount')}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="pt-4 pb-3 px-3 text-center">
              <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <div className="text-2xl font-bold text-green-600">{todayTrips.length}</div>
              <p className="text-xs text-muted-foreground">{t('driverPortal.todayTrips')}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
            <CardContent className="pt-4 pb-3 px-3 text-center">
              <Navigation className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <div className="text-2xl font-bold text-blue-600">{activeTrips.length}</div>
              <p className="text-xs text-muted-foreground">{t('driverPortal.activeNow')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Trip Banner */}
        {activeTrips.length > 0 && (
          <Card className="border-0 shadow-md bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
                    <Navigation className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{t('driverPortal.activeTrip')}</p>
                    <p className="text-sm text-white/80">{t('driverPortal.tapToContinue')}</p>
                  </div>
                </div>
                <Button className="bg-white text-green-700 hover:bg-white/90 shadow-lg" onClick={() => setSelectedRouteId(activeTrips[0].route_id)}>
                  {t('driverPortal.continueTrip')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Routes & History Tabs */}
        <Tabs defaultValue="routes">
          <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="routes" className="flex-1 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <Bus className="h-4 w-4" />
              {t('driverPortal.routesTab')}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <MessageCircle className="h-4 w-4" />
              {t('driverPortal.chatTab')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <History className="h-4 w-4" />
              {t('driverPortal.historyTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="routes" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : assignedRoutes.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-medium">{t('driverPortal.noRoutesAssigned')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {assignedRoutes.map((route) => {
                  const activeTrip = getActiveTrip(route.id);
                  const studentCount = route.route_assignments?.[0]?.count || 0;

                  return (
                    <Card key={route.id} className={`border-0 shadow-md overflow-hidden transition-all ${activeTrip ? "ring-2 ring-green-500 shadow-green-100" : ""}`}>
                      {activeTrip && <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Bus className="h-5 w-5 text-primary" />
                            </div>
                            {route.name}
                          </CardTitle>
                          {activeTrip && <Badge className="bg-green-500 shadow-sm">{t('common.active')}</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground p-2 bg-muted/50 rounded-lg">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="truncate">{route.schools?.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground p-2 bg-muted/50 rounded-lg">
                            <Users className="h-4 w-4 text-primary" />
                            {studentCount} {t('driverPortal.studentsCount')}
                          </div>
                          {route.route_duration_minutes && (
                            <div className="flex items-center gap-2 text-muted-foreground p-2 bg-muted/50 rounded-lg col-span-2">
                              <Clock className="h-4 w-4 text-primary" />
                              {t('driverPortal.tripDuration')}: {route.route_duration_minutes} {t('driverPortal.minutes')}
                            </div>
                          )}
                        </div>

                        {isDriver && route.supervisors && (
                          <div className="flex items-center gap-3 p-3 border rounded-xl bg-purple-50/50 dark:bg-purple-950/20">
                            <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                              <Shield className="h-4 w-4 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{route.supervisors.full_name}</p>
                              <p className="text-xs text-muted-foreground">{t('driverPortal.theSupervisor')}</p>
                            </div>
                            <a href={`tel:${route.supervisors.phone}`}>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                                <Phone className="h-4 w-4 text-primary" />
                              </Button>
                            </a>
                          </div>
                        )}
                        {isSupervisor && route.drivers && (
                          <div className="flex items-center gap-3 p-3 border rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
                            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{route.drivers.full_name}</p>
                              <p className="text-xs text-muted-foreground">{t('driverPortal.theDriver')}</p>
                            </div>
                            <a href={`tel:${route.drivers.phone}`}>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                                <Phone className="h-4 w-4 text-primary" />
                              </Button>
                            </a>
                          </div>
                        )}

                        <Button
                          className={`w-full gap-2 h-11 rounded-xl shadow-md ${activeTrip ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-primary hover:bg-primary/90 shadow-primary/20"}`}
                          onClick={() => setSelectedRouteId(route.id)}
                        >
                          {activeTrip ? (
                            <><Navigation className="h-4 w-4" />{t('driverPortal.continueTrip2')}</>
                          ) : (
                            <><Play className="h-4 w-4" />{t('driverPortal.startTrip')}</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <DriverChatSection />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {assignedRoutes.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  {t('driverPortal.noRoutes')}
                </CardContent>
              </Card>
            ) : assignedRoutes.length === 1 ? (
              <TripHistory routeId={assignedRoutes[0].id} routeName={assignedRoutes[0].name} />
            ) : (
              <div className="space-y-4">
                {!historyRouteId ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">{t('driverPortal.selectRouteHistory')}</p>
                    {assignedRoutes.map((route) => (
                      <Card key={route.id} className="cursor-pointer hover:border-primary/30 transition-all border-0 shadow-sm hover:shadow-md" onClick={() => setHistoryRouteId(route.id)}>
                        <CardContent className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Bus className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium text-sm">{route.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{route.schools?.name}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div>
                    <Button variant="ghost" size="sm" className="mb-3" onClick={() => setHistoryRouteId(null)}>
                      {t('driverPortal.backToRoutes')}
                    </Button>
                    <TripHistory routeId={historyRouteId} routeName={assignedRoutes.find((r) => r.id === historyRouteId)?.name} />
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedRouteId} onOpenChange={() => setSelectedRouteId(null)}>
        <DialogContent className="max-w-4xl h-[95vh] p-0">
          {selectedRouteId && (
            <GoogleMapsProvider>
              <DriverTripInterface routeId={selectedRouteId} onClose={() => setSelectedRouteId(null)} />
            </GoogleMapsProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
