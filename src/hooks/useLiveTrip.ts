import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TripStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type StudentStatus = "pending" | "arriving" | "picked_up" | "dropped_off";
export type NotificationType = 
  | "trip_started"
  | "arriving_soon"
  | "arrived_at_pickup"
  | "picked_up"
  | "arrived_at_school"
  | "trip_completed";

export interface LiveTrip {
  id: string;
  route_id: string;
  driver_id: string | null;
  supervisor_id: string | null;
  started_by: string | null;
  status: TripStatus;
  started_at: string | null;
  completed_at: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_update: string | null;
  created_at: string;
  updated_at: string;
  routes?: {
    name: string;
    school_id: string;
    schools?: {
      name: string;
      latitude: number;
      longitude: number;
    };
    drivers?: {
      full_name: string;
      phone: string;
    };
    supervisors?: {
      full_name: string;
      phone: string;
    };
  };
}

export interface TripStudentStatus {
  id: string;
  live_trip_id: string;
  registration_id: string;
  pickup_order: number | null;
  status: StudentStatus;
  arrived_at: string | null;
  picked_up_at: string | null;
  dropped_off_at: string | null;
  registrations?: {
    student_name: string;
    grade?: string | null;
    parent_accounts?: {
      parent_name: string;
      father_phone: string;
      mother_phone?: string | null;
      pickup_address?: string | null;
      pickup_latitude: number;
      pickup_longitude: number;
    };
  };
}

export interface TripNotification {
  id: string;
  live_trip_id: string;
  registration_id: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  sent_at: string;
  read_at: string | null;
}

export function useLiveTrip(routeId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active trip for a route
  const { data: activeTrip, isLoading: tripLoading } = useQuery({
    queryKey: ["live-trip", routeId],
    queryFn: async () => {
      if (!routeId) return null;
      
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
        .eq("route_id", routeId)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LiveTrip | null;
    },
    enabled: !!routeId,
  });

  // Fetch students for active trip
  const { data: tripStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["trip-students", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      
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
        .eq("live_trip_id", activeTrip.id)
        .order("pickup_order", { ascending: true });

      if (error) throw error;
      return data as TripStudentStatus[];
    },
    enabled: !!activeTrip?.id,
  });

  // Start trip mutation
  const startTripMutation = useMutation({
    mutationFn: async (data: { routeId: string; driverId?: string; supervisorId?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Create live trip
      const { data: trip, error: tripError } = await supabase
        .from("live_trips")
        .insert({
          route_id: data.routeId,
          driver_id: data.driverId || null,
          supervisor_id: data.supervisorId || null,
          started_by: user.user.id,
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (tripError) throw tripError;

      // Get all students assigned to this route (cancelled registrations excluded)
      const { data: rawAssignments, error: assignError } = await supabase
        .from("route_assignments")
        .select("registration_id, pickup_order, registrations(status)")
        .eq("route_id", data.routeId);

      if (assignError) throw assignError;

      const assignments = (rawAssignments || []).filter(
        (a: any) => a.registrations && a.registrations.status !== "cancelled"
      );

      // Create status entries for each student
      if (assignments && assignments.length > 0) {
        const studentStatuses = assignments.map((a) => ({
          live_trip_id: trip.id,
          registration_id: a.registration_id,
          pickup_order: a.pickup_order,
          status: "pending",
        }));

        const { error: statusError } = await supabase
          .from("trip_student_status")
          .insert(studentStatuses);

        if (statusError) throw statusError;
      }

      // Send trip started notification to all parents
      const { error: notifError } = await supabase
        .from("trip_notifications")
        .insert(
          assignments?.map((a) => ({
            live_trip_id: trip.id,
            registration_id: a.registration_id,
            notification_type: "trip_started" as const,
            title: "الرحلة بدأت",
            message: "بدأ الباص في الطريق لاستلام الطلاب",
          })) || []
        );

      if (notifError) console.error("Failed to send notifications:", notifError);

      return trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-trip"] });
      toast({ title: "تم بدء الرحلة", description: "تم إرسال إشعار لجميع أولياء الأمور" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Update driver location
  const updateLocationMutation = useMutation({
    mutationFn: async (data: { tripId: string; lat: number; lng: number }) => {
      const { error } = await supabase
        .from("live_trips")
        .update({
          current_latitude: data.lat,
          current_longitude: data.lng,
          last_location_update: new Date().toISOString(),
        })
        .eq("id", data.tripId);

      if (error) throw error;
    },
  });

  // Update student status
  const updateStudentStatusMutation = useMutation({
    mutationFn: async (data: {
      statusId: string;
      registrationId: string;
      tripId: string;
      status: StudentStatus;
      notificationType?: NotificationType;
    }) => {
      const updates: Record<string, unknown> = { status: data.status };
      
      if (data.status === "arriving") {
        updates.arrived_at = new Date().toISOString();
      } else if (data.status === "picked_up") {
        updates.picked_up_at = new Date().toISOString();
      } else if (data.status === "dropped_off") {
        updates.dropped_off_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("trip_student_status")
        .update(updates)
        .eq("id", data.statusId);

      if (error) throw error;

      // Send notification if type provided
      if (data.notificationType) {
        const titles: Record<NotificationType, string> = {
          trip_started: "الرحلة بدأت",
          arriving_soon: "الباص في الطريق",
          arrived_at_pickup: "الباص وصل",
          picked_up: "تم استلام الطالب",
          arrived_at_school: "وصل للمدرسة",
          trip_completed: "انتهت الرحلة",
        };

        const messages: Record<NotificationType, string> = {
          trip_started: "بدأ الباص في الطريق",
          arriving_soon: "الباص على وشك الوصول لموقعك",
          arrived_at_pickup: "الباص في موقع الاستلام",
          picked_up: "تم استلام طفلك بنجاح",
          arrived_at_school: "وصل الباص للمدرسة",
          trip_completed: "تمت الرحلة بنجاح",
        };

        await supabase.from("trip_notifications").insert({
          live_trip_id: data.tripId,
          registration_id: data.registrationId,
          notification_type: data.notificationType,
          title: titles[data.notificationType],
          message: messages[data.notificationType],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-students"] });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // End trip mutation
  const endTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      // Mark all remaining students as dropped off
      await supabase
        .from("trip_student_status")
        .update({
          status: "dropped_off",
          dropped_off_at: new Date().toISOString(),
        })
        .eq("live_trip_id", tripId)
        .neq("status", "dropped_off");

      // Complete the trip
      const { error } = await supabase
        .from("live_trips")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", tripId);

      if (error) throw error;

      // Send completion notifications
      const { data: students } = await supabase
        .from("trip_student_status")
        .select("registration_id")
        .eq("live_trip_id", tripId);

      if (students) {
        await supabase.from("trip_notifications").insert(
          students.map((s) => ({
            live_trip_id: tripId,
            registration_id: s.registration_id,
            notification_type: "trip_completed" as const,
            title: "انتهت الرحلة",
            message: "تم توصيل الطلاب بنجاح",
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-trip"] });
      toast({ title: "تم إنهاء الرحلة", description: "تم إرسال إشعار لجميع أولياء الأمور" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  return {
    activeTrip,
    tripStudents,
    isLoading: tripLoading || studentsLoading,
    startTrip: startTripMutation.mutate,
    updateLocation: updateLocationMutation.mutate,
    updateStudentStatus: updateStudentStatusMutation.mutate,
    endTrip: endTripMutation.mutate,
    isStarting: startTripMutation.isPending,
    isEnding: endTripMutation.isPending,
  };
}

export function useLiveTripRealtime(tripId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`live-trip-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_trips",
          filter: `id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-trip"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_student_status",
          filter: `live_trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["trip-students"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, queryClient]);
}

export function useParentNotifications(userId?: string) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["parent-notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_notifications")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as TripNotification[];
    },
    enabled: !!userId,
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("parent-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["parent-notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("trip_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    queryClient.invalidateQueries({ queryKey: ["parent-notifications"] });
  };

  return { notifications, isLoading, markAsRead };
}
