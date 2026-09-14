import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ code: "SESSION_EXPIRED", error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ code: "SESSION_EXPIRED", error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const routeId = typeof body?.routeId === "string" ? body.routeId : "";
    if (!routeId) return json({ code: "BAD_REQUEST", error: "routeId is required" }, 400);

    const { data: route } = await admin
      .from("routes")
      .select("id, driver_id, supervisor_id, is_active")
      .eq("id", routeId)
      .maybeSingle();
    if (!route) return json({ code: "NOT_FOUND", error: "Route not found" }, 404);

    // Who is calling: staff account (driver/supervisor) or an employee
    const { data: account } = await admin
      .from("driver_accounts")
      .select("driver_id, supervisor_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    const isEmployee = !!roleRow;

    const today = new Date().toISOString().slice(0, 10);
    let isCovering = false;
    if (account && (account.driver_id || account.supervisor_id)) {
      const filters = [
        account.driver_id ? `covering_driver_id.eq.${account.driver_id}` : null,
        account.supervisor_id ? `covering_supervisor_id.eq.${account.supervisor_id}` : null,
      ].filter(Boolean) as string[];

      const { data: coverage } = await admin
        .from("staff_coverage")
        .select("id")
        .eq("route_id", routeId)
        .eq("coverage_date", today)
        .or(filters.join(","))
        .limit(1)
        .maybeSingle();
      isCovering = !!coverage;
    }

    const isAssigned =
      !!account &&
      ((!!account.driver_id && account.driver_id === route.driver_id) ||
        (!!account.supervisor_id && account.supervisor_id === route.supervisor_id));

    if (!isEmployee && !isAssigned && !isCovering) {
      return json({ code: "NOT_ASSIGNED", error: "Not assigned to this route" }, 403);
    }

    // Idempotent: reuse a trip that is already running on this line
    const { data: running } = await admin
      .from("live_trips")
      .select("*")
      .eq("route_id", routeId)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (running) return json({ trip: running, existed: true });

    const { data: trip, error: tripErr } = await admin
      .from("live_trips")
      .insert({
        route_id: routeId,
        driver_id: route.driver_id,
        supervisor_id: route.supervisor_id,
        started_by: userId,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (tripErr) return json({ code: "INSERT_FAILED", error: tripErr.message }, 500);

    const { data: rawAssignments } = await admin
      .from("route_assignments")
      .select("registration_id, pickup_order, registrations(status)")
      .eq("route_id", routeId);

    const assignments = (rawAssignments ?? []).filter(
      (a: any) => a.registrations && a.registrations.status !== "cancelled",
    );

    if (assignments.length > 0) {
      await admin.from("trip_student_status").insert(
        assignments.map((a: any) => ({
          live_trip_id: trip.id,
          registration_id: a.registration_id,
          pickup_order: a.pickup_order,
          status: "pending",
        })),
      );

      await admin.from("trip_notifications").insert(
        assignments.map((a: any) => ({
          live_trip_id: trip.id,
          registration_id: a.registration_id,
          notification_type: "trip_started",
          title: "الرحلة بدأت",
          message: "بدأ الباص في الطريق لاستلام الطلاب",
        })),
      );
    }

    return json({ trip, existed: false });
  } catch (e) {
    return json({ code: "UNEXPECTED", error: (e as Error).message }, 500);
  }
});
