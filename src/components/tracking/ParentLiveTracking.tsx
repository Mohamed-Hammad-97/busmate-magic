import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentNotifications, type LiveTrip, type TripStudentStatus } from "@/hooks/useLiveTrip";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { LiveTripMap } from "./LiveTripMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Bus, Bell, Clock, CheckCircle2, Navigation, Phone,
  User, Loader2, Shield,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500", description: "الباص لم يصل بعد" },
  arriving: { label: "الباص في الطريق", color: "bg-blue-500", description: "الباص على وشك الوصول" },
  picked_up: { label: "تم الاستلام", color: "bg-green-500", description: "طفلك في الباص" },
  dropped_off: { label: "تم التوصيل", color: "bg-muted-foreground", description: "وصل طفلك للمدرسة" },
};

export function ParentLiveTracking() {
  const { user, parentAccount } = useParentAuth();
  const { notifications, markAsRead } = useParentNotifications(user?.id);

  const { data: registrations = [], isLoading: registrationsLoading } = useQuery({
    queryKey: ["parent-registrations-tracking", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id, student_name,
          schools (name),
          route_assignments (
            route_id,
            routes (
              name,
              drivers (full_name, phone),
              supervisors (full_name, phone)
            )
          )
        `)
        .eq("parent_id", parentAccount.id)
        .eq("status", "complete");
      if (error) throw error;
      return data;
    },
    enabled: !!parentAccount?.id,
  });

  const routeIds = registrations
    .flatMap((r) => r.route_assignments?.map((ra) => ra.route_id) || [])
    .filter(Boolean);

  const { data: activeTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["parent-active-trips", routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("live_trips")
        .select(`
          *,
          routes (
            name, school_id,
            schools (name, latitude, longitude),
            drivers (full_name, phone),
            supervisors (full_name, phone)
          )
        `)
        .in("route_id", routeIds)
        .eq("status", "in_progress");
      if (error) throw error;
      return data as LiveTrip[];
    },
    enabled: routeIds.length > 0,
    refetchInterval: 10000,
  });

  const activeTripIds = activeTrips.map((t) => t.id);

  const { data: studentStatuses = [] } = useQuery({
    queryKey: ["parent-student-statuses", activeTripIds],
    queryFn: async () => {
      if (activeTripIds.length === 0) return [];
      const registrationIds = registrations.map((r) => r.id);
      const { data, error } = await supabase
        .from("trip_student_status")
        .select(`
          *,
          registrations (
            student_name,
            parent_accounts (
              parent_name, father_phone,
              pickup_latitude, pickup_longitude
            )
          )
        `)
        .in("live_trip_id", activeTripIds)
        .in("registration_id", registrationIds);
      if (error) throw error;
      return data as TripStudentStatus[];
    },
    enabled: activeTripIds.length > 0,
    refetchInterval: 5000,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (activeTrips.length === 0) return;
    const channels = activeTrips.map((trip) => {
      const channel = supabase
        .channel(`parent-live-trip-${trip.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "live_trips", filter: `id=eq.${trip.id}` },
          () => { queryClient.invalidateQueries({ queryKey: ["parent-active-trips"] }); })
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_student_status", filter: `live_trip_id=eq.${trip.id}` },
          () => { queryClient.invalidateQueries({ queryKey: ["parent-student-statuses"] }); })
        .subscribe();
      return channel;
    });
    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [activeTrips.map((t) => t.id).join(","), queryClient]);

  const unreadNotifications = notifications.filter((n) => !n.read_at);
  const isLoading = registrationsLoading || tripsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activeTrips.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Bus className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="font-bold text-lg mb-2">لا توجد رحلات نشطة</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            ستظهر هنا رحلة الباص عندما يبدأ السائق الرحلة
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentTrip = activeTrips[0];
  const currentStudentStatuses = studentStatuses.filter((s) => s.live_trip_id === currentTrip.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center animate-pulse">
              <Navigation className="h-4 w-4 text-white" />
            </div>
            تتبع الباص
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {currentTrip.routes?.name} - {currentTrip.routes?.schools?.name}
          </p>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative rounded-xl h-10 w-10">
              <Bell className="h-5 w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold shadow-sm">
                  {unreadNotifications.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>الإشعارات</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-100px)] mt-4">
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد إشعارات</p>
                ) : (
                  notifications.map((notif) => (
                    <Card
                      key={notif.id}
                      className={`p-3 cursor-pointer transition-all border-0 shadow-sm ${
                        !notif.read_at ? "bg-primary/5 ring-1 ring-primary/20" : ""
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.sent_at), { addSuffix: true, locale: ar })}
                          </p>
                        </div>
                        {!notif.read_at && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Live Map */}
      <Card className="overflow-hidden border-0 shadow-lg rounded-2xl">
        <div className="h-[300px]">
          <LiveTripMap trip={currentTrip} students={currentStudentStatuses} showDriverLocation={true} isDriver={false} />
        </div>
      </Card>

      {/* Driver/Supervisor Info */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">معلومات الرحلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentTrip.routes?.drivers && (
            <div className="flex items-center justify-between p-3 border rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentTrip.routes.drivers.full_name}</p>
                  <p className="text-xs text-muted-foreground">السائق</p>
                </div>
              </div>
              <a href={`tel:${currentTrip.routes.drivers.phone}`} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <Phone className="h-4 w-4 text-primary" />
              </a>
            </div>
          )}
          {currentTrip.routes?.supervisors && (
            <div className="flex items-center justify-between p-3 border rounded-xl bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentTrip.routes.supervisors.full_name}</p>
                  <p className="text-xs text-muted-foreground">المشرفة</p>
                </div>
              </div>
              <a href={`tel:${currentTrip.routes.supervisors.phone}`} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <Phone className="h-4 w-4 text-primary" />
              </a>
            </div>
          )}
          {currentTrip.last_location_update && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Clock className="h-3 w-3" />
              آخر تحديث: {formatDistanceToNow(new Date(currentTrip.last_location_update), { addSuffix: true, locale: ar })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Children Status */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">حالة الأطفال</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentStudentStatuses.map((student) => {
            const statusConfig = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
            return (
              <div key={student.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${statusConfig.color} flex items-center justify-center text-white shadow-sm`}>
                    {student.status === "pending" && <Clock className="h-5 w-5" />}
                    {student.status === "arriving" && <Navigation className="h-5 w-5" />}
                    {(student.status === "picked_up" || student.status === "dropped_off") && <CheckCircle2 className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{student.registrations?.student_name}</p>
                    <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`${statusConfig.color} text-white border-0 shadow-sm`}>
                  {statusConfig.label}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
