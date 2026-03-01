import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentNotifications, type LiveTrip, type TripStudentStatus } from "@/hooks/useLiveTrip";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { LiveTripMap } from "./LiveTripMap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Bus, Bell, Clock, CheckCircle2, Navigation, Phone,
  User, Loader2, Shield, AlertTriangle, MapPin, Gauge,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  pending: { label: "Waiting", color: "bg-amber-500", description: "Bus hasn't arrived yet" },
  arriving: { label: "Arriving", color: "bg-blue-500", description: "Bus is on the way" },
  picked_up: { label: "Picked Up", color: "bg-green-500", description: "Your child is on the bus" },
  dropped_off: { label: "Dropped Off", color: "bg-muted-foreground", description: "Arrived at school" },
};

export function ParentLiveTracking() {
  const { user, parentAccount } = useParentAuth();
  const { notifications, markAsRead } = useParentNotifications(user?.id);
  const isMobile = useIsMobile();

  const { data: registrations = [], isLoading: registrationsLoading } = useQuery({
    queryKey: ["parent-registrations-tracking", parentAccount?.id],
    queryFn: async () => {
      if (!parentAccount?.id) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id, student_name, student_photo_url,
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
          <h3 className="font-bold text-lg mb-2">No Active Trips</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            The bus trip will appear here when the driver starts the route
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentTrip = activeTrips[0];
  const currentStudentStatuses = studentStatuses.filter((s) => s.live_trip_id === currentTrip.id);

  // Find the student's registration for info display
  const studentReg = registrations[0];
  const routeAssignment = studentReg?.route_assignments?.[0];

  return (
    <div className="relative">
      {/* Full Map */}
      <Card className="overflow-hidden border-0 shadow-lg rounded-2xl">
        <div className="relative h-[65vh] min-h-[400px]">
          <LiveTripMap trip={currentTrip} students={currentStudentStatuses} showDriverLocation={true} isDriver={false} />

          {/* Floating overlay panel */}
          <div className={`absolute top-3 left-3 z-10 ${isMobile ? 'right-3 max-w-none' : 'w-80'}`}>
            <Card className="border-0 shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Live badge + route */}
                <div className="p-3 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge className="bg-green-500 text-white border-0 text-[10px] px-2 py-0.5 gap-1 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      LIVE NOW
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {currentTrip.routes?.name}
                    </Badge>
                  </div>
                </div>

                {/* Bus info */}
                <div className="p-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Bus className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{currentTrip.routes?.schools?.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentTrip.routes?.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Speed + Driver */}
                <div className="p-3 border-b grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Speed</p>
                      <p className="text-sm font-semibold">— km/h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Driver</p>
                      <p className="text-sm font-semibold truncate">{currentTrip.routes?.drivers?.full_name || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Route progress */}
                {currentStudentStatuses.length > 0 && (
                  <div className="p-3 border-b">
                    <p className="text-xs text-muted-foreground mb-2">Route Progress</p>
                    <div className="space-y-2">
                      {currentStudentStatuses.map((student) => {
                        const statusConfig = STATUS_LABELS[student.status] || STATUS_LABELS.pending;
                        return (
                          <div key={student.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
                              <span className="text-xs font-medium">{student.registrations?.student_name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {statusConfig.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Call Driver button */}
                {currentTrip.routes?.drivers?.phone && (
                  <div className="p-3 space-y-2">
                    <a
                      href={`tel:${currentTrip.routes.drivers.phone}`}
                      className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Call Driver
                    </a>
                    <button className="flex items-center justify-center gap-2 w-full text-muted-foreground hover:text-foreground rounded-xl py-2 text-xs transition-colors">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Report an Issue
                    </button>
                  </div>
                )}

                {/* Your child info */}
                {studentReg && (
                  <div className="p-3 border-t bg-muted/30">
                    <div className="flex items-center gap-2.5">
                      {(studentReg as any).student_photo_url ? (
                        <img
                          src={(studentReg as any).student_photo_url}
                          alt={studentReg.student_name}
                          className="h-9 w-9 rounded-full object-cover border-2 border-background shadow"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Your Child</p>
                        <p className="text-xs font-semibold">{studentReg.student_name}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notification bell */}
          <div className="absolute top-3 right-3 z-10">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" className="relative rounded-xl h-10 w-10 shadow-lg bg-background/95 backdrop-blur-xl">
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
                  <SheetTitle>Notifications</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  <div className="space-y-3">
                    {notifications.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No notifications</p>
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
                                {formatDistanceToNow(new Date(notif.sent_at), { addSuffix: true })}
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
        </div>
      </Card>
    </div>
  );
}