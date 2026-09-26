import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driverPortalClient as supabase, ensureFreshDriverSession } from "@/lib/driverPortalClient";
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
            grade,
            parent_accounts (
              parent_name,
              father_phone,
              mother_phone,
              pickup_address,
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

  // Start trip mutation (handled server-side so permissions are checked safely)
  const startTripMutation = useMutation({
    mutationFn: async (data: { routeId: string; driverId?: string; supervisorId?: string }) => {
      // Make sure we send a usable session; stale tokens caused silent permission errors
      await ensureFreshDriverSession();

      const attempt = async () => {
        const { data: result, error } = await supabase.functions.invoke("start-live-trip", {
          body: { routeId: data.routeId },
        });

        if (error) {
          let code = "";
          let message = error.message;
          try {
            const ctx = (error as any).context;
            const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            if (parsed) {
              code = parsed.code || "";
              message = parsed.error || message;
            }
          } catch {
            // keep default message
          }
          const err = new Error(
            code === "NOT_ASSIGNED" ? "أنت غير مسؤول عن هذا الخط اليوم." : message,
          );
          (err as any).code = code;
          throw err;
        }

        return (result as { trip: LiveTrip }).trip;
      };

      try {
        return await attempt();
      } catch (error) {
        if ((error as any).code !== "SESSION_EXPIRED") throw error;
        // Renew silently and retry once before bothering the supervisor.
        const { data: current } = await supabase.auth.getSession();
        const token = current.session?.refresh_token;
        const renewed = token
          ? await supabase.auth.refreshSession({ refresh_token: token })
          : null;
        if (!renewed || renewed.error || !renewed.data.session) {
          const err = new Error("انتهت صلاحية الجلسة. برجاء تسجيل الدخول مرة أخرى.");
          (err as any).code = "SESSION_EXPIRED_FINAL";
          throw err;
        }
        return await attempt();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-trip"] });
      toast({ title: "تم بدء الرحلة", description: "تم إرسال إشعار لجميع أولياء الأمور" });
    },
    onError: async (error) => {
      const code = (error as any).code;
      if (code === "SESSION_EXPIRED_FINAL") {
        toast({
          title: "انتهت صلاحية الجلسة",
          description: "برجاء تسجيل الدخول مرة أخرى لبدء الرحلة.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Update driver location
  const updateLocationMutation = useMutation({
    mutationFn: async (data: { tripId: string; lat: number; lng: number }) => {
      await ensureFreshDriverSession();

      const attempt = async () => {
        const { data: result, error } = await supabase.functions.invoke("update-live-trip-location", {
          body: data,
        });

        if (!error) return result;

        let code = "";
        let message = error.message;
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ code?: string; error?: string }> } }).context;
          const parsed = ctx?.json ? await ctx.json() : null;
          code = parsed?.code ?? "";
          message = parsed?.error ?? message;
        } catch {
          // Keep the original function error.
        }

        const requestError = new Error(message) as Error & { code?: string };
        requestError.code = code;
        throw requestError;
      };

      const TRANSIENT = new Set(["LOOKUP_FAILED", "PERMISSION_CHECK_FAILED", "UPDATE_FAILED", "UNEXPECTED", ""]);
      let sessionRetried = false;
      for (let i = 0; ; i++) {
        try {
          return await attempt();
        } catch (error) {
          const code = (error as Error & { code?: string }).code ?? "";
          if (code === "SESSION_EXPIRED" && !sessionRetried) {
            sessionRetried = true;
            await ensureFreshDriverSession();
            continue;
          }
          // Brief backoff for temporary server/network hiccups; a newer GPS
          // point arrives every few seconds anyway, so don't retry for long.
          if (TRANSIENT.has(code) && i < 2) {
            await new Promise((r) => setTimeout(r, 500 * 2 ** i));
            continue;
          }
          throw error;
        }
      }
    },
    retry: false,
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

  // End trip mutation (handled server-side so a stale token never silently skips the update)
  const endTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      await ensureFreshDriverSession();

      const attempt = async () => {
        const { data: result, error } = await supabase.functions.invoke("end-live-trip", {
          body: { tripId },
        });

        if (error) {
          let code = "";
          let message = error.message;
          try {
            const ctx = (error as any).context;
            const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            if (parsed) {
              code = parsed.code || "";
              message = parsed.error || message;
            }
          } catch {
            // keep default message
          }
          const err = new Error(
            code === "NOT_ASSIGNED" ? "أنت غير مسؤول عن هذا الخط اليوم." : message,
          );
          (err as any).code = code;
          throw err;
        }

        const trip = (result as { trip?: { status?: string } } | null)?.trip;
        if (!trip || trip.status !== "completed") {
          throw new Error("لم يتم إنهاء الرحلة. برجاء المحاولة مرة أخرى.");
        }
        return trip;
      };

      try {
        return await attempt();
      } catch (error) {
        if ((error as any).code !== "SESSION_EXPIRED") throw error;
        const { data: current } = await supabase.auth.getSession();
        const token = current.session?.refresh_token;
        const renewed = token
          ? await supabase.auth.refreshSession({ refresh_token: token })
          : null;
        if (!renewed || renewed.error || !renewed.data.session) {
          const err = new Error("انتهت صلاحية الجلسة. برجاء المحاولة مرة أخرى.");
          (err as any).code = "SESSION_EXPIRED_FINAL";
          throw err;
        }
        return await attempt();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-trip"] });
      queryClient.invalidateQueries({ queryKey: ["trip-students"] });
      toast({ title: "تم إنهاء الرحلة", description: "تم إرسال إشعار لجميع أولياء الأمور" });
    },
    onError: (error) => {
      const code = (error as any).code;
      toast({
        title: code === "SESSION_EXPIRED_FINAL" ? "انتهت صلاحية الجلسة" : "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    activeTrip,
    tripStudents,
    isLoading: tripLoading || studentsLoading,
    startTrip: startTripMutation.mutate,
    updateLocation: updateLocationMutation.mutateAsync,
    updateStudentStatus: updateStudentStatusMutation.mutate,
    endTrip: endTripMutation.mutate,
    isStarting: startTripMutation.isPending,
    isEnding: endTripMutation.isPending,
    isUpdatingLocation: updateLocationMutation.isPending,
    locationUpdateError: updateLocationMutation.error,
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
