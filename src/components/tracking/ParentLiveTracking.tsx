import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTripRealtime, useParentNotifications, type LiveTrip, type TripStudentStatus } from "@/hooks/useLiveTrip";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { LiveTripMap } from "./LiveTripMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Bus,
  Bell,
  Clock,
  CheckCircle2,
  Navigation,
  Phone,
  MapPin,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  pending: { label: "في الانتظار", color: "bg-amber-500", description: "الباص لم يصل بعد" },
  arriving: { label: "الباص في الطريق", color: "bg-blue-500", description: "الباص على وشك الوصول" },
  picked_up: { label: "تم الاستلام", color: "bg-green-500", description: "طفلك في الباص" },
  dropped_off: { label: "تم التوصيل", color: "bg-gray-500", description: "وصل طفلك للمدرسة" },
};

export function ParentLiveTracking() {
  const { user, parentAccount } = useParentAuth();
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const { notifications, markAsRead } = useParentNotifications(user?.id);

  // Fetch parent's registrations with active trips
  const { data: registrations = [], isLoading: registrationsLoading } = useQuery({
    queryKey: ["parent-registrations-tracking", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];

      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id,
          student_name,
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

  // Get route IDs from registrations
  const routeIds = registrations
    .flatMap((r) => r.route_assignments?.map((ra) => ra.route_id) || [])
    .filter(Boolean);

  // Fetch active trips for parent's routes
  const { data: activeTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["parent-active-trips", routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return [];

      const { data, error } = await supabase
        .from("live_trips")
        .select(`
          *,
          routes (
            name,
            school_id,
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
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch student statuses for active trips
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
              parent_name,
              father_phone,
              pickup_latitude,
              pickup_longitude
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

  // Subscribe to realtime updates for each active trip
  activeTrips.forEach((trip) => {
    useLiveTripRealtime(trip.id);
  });

  const unreadNotifications = notifications.filter((n) => !n.read_at);

  const isLoading = registrationsLoading || tripsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (activeTrips.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Bus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">لا توجد رحلات نشطة</h3>
          <p className="text-muted-foreground text-sm">
            ستظهر هنا رحلة الباص عندما يبدأ السائق الرحلة
          </p>
        </CardContent>
      </Card>
    );
  }

  // Use first active trip for map view
  const currentTrip = activeTrips[0];
  const currentStudentStatuses = studentStatuses.filter(
    (s) => s.live_trip_id === currentTrip.id
  );

  return (
    <div className="space-y-4">
      {/* Header with notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">تتبع الباص</h2>
          <p className="text-sm text-muted-foreground">
            {currentTrip.routes?.name} - {currentTrip.routes?.schools?.name}
          </p>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
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
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد إشعارات
                  </p>
                ) : (
                  notifications.map((notif) => (
                    <Card
                      key={notif.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        !notif.read_at ? "bg-primary/5 border-primary/20" : ""
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.sent_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </p>
                        </div>
                        {!notif.read_at && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
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
      <Card className="overflow-hidden">
        <div className="h-[300px]">
          <LiveTripMap
            trip={currentTrip}
            students={currentStudentStatuses}
            showDriverLocation={true}
            isDriver={false}
          />
        </div>
      </Card>

      {/* Driver/Supervisor Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">معلومات الرحلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentTrip.routes?.drivers && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">السائق</p>
                  <p className="text-xs text-muted-foreground">
                    {currentTrip.routes.drivers.full_name}
                  </p>
                </div>
              </div>
              <a
                href={`tel:${currentTrip.routes.drivers.phone}`}
                className="p-2 hover:bg-muted rounded-full"
              >
                <Phone className="h-4 w-4" />
              </a>
            </div>
          )}
          
          {currentTrip.routes?.supervisors && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">المشرف</p>
                  <p className="text-xs text-muted-foreground">
                    {currentTrip.routes.supervisors.full_name}
                  </p>
                </div>
              </div>
              <a
                href={`tel:${currentTrip.routes.supervisors.phone}`}
                className="p-2 hover:bg-muted rounded-full"
              >
                <Phone className="h-4 w-4" />
              </a>
            </div>
          )}

          {currentTrip.last_location_update && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              آخر تحديث:{" "}
              {formatDistanceToNow(new Date(currentTrip.last_location_update), {
                addSuffix: true,
                locale: ar,
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Children Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">حالة الأطفال</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentStudentStatuses.map((student) => {
            const statusConfig = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
            return (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full ${statusConfig.color} flex items-center justify-center text-white`}
                  >
                    {student.status === "pending" && <Clock className="h-5 w-5" />}
                    {student.status === "arriving" && <Navigation className="h-5 w-5" />}
                    {(student.status === "picked_up" || student.status === "dropped_off") && (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{student.registrations?.student_name}</p>
                    <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`${statusConfig.color} text-white border-0`}
                >
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
