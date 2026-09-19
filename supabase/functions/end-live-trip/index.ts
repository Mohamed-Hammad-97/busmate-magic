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
    const tripId = typeof body?.tripId === "string" ? body.tripId : "";
    if (!tripId) return json({ code: "BAD_REQUEST", error: "tripId is required" }, 400);

    const { data: trip } = await admin
      .from("live_trips")
      .select("id, route_id, status")
      .eq("id", tripId)
      .maybeSingle();
    if (!trip) return json({ code: "NOT_FOUND", error: "Trip not found" }, 404);

    const { data: route } = await admin
      .from("routes")
      .select("id, driver_id, supervisor_id")
      .eq("id", trip.route_id)
      .maybeSingle();

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
        .eq("route_id", trip.route_id)
        .eq("coverage_date", today)
        .or(filters.join(","))
        .limit(1)
        .maybeSingle();
      isCovering = !!coverage;
    }

    const isAssigned =
      !!account && !!route &&
      ((!!account.driver_id && account.driver_id === route.driver_id) ||
        (!!account.supervisor_id && account.supervisor_id === route.supervisor_id));

    if (!isEmployee && !isAssigned && !isCovering) {
      return json({ code: "NOT_ASSIGNED", error: "Not assigned to this route" }, 403);
    }

    // Idempotent: already finished
    if (trip.status === "completed") {
      return json({ trip, existed: true });
    }

    const now = new Date().toISOString();

    await admin
      .from("trip_student_status")
      .update({ status: "dropped_off", dropped_off_at: now })
      .eq("live_trip_id", tripId)
      .neq("status", "dropped_off");

    const { data: completed, error: updErr } = await admin
      .from("live_trips")
      .update({ status: "completed", completed_at: now })
      .eq("id", tripId)
      .select()
      .maybeSingle();

    if (updErr || !completed) {
      return json({ code: "UPDATE_FAILED", error: updErr?.message ?? "Trip was not completed" }, 500);
    }

    const { data: students } = await admin
      .from("trip_student_status")
      .select("registration_id")
      .eq("live_trip_id", tripId);

    if (students && students.length > 0) {
      await admin.from("trip_notifications").insert(
        students.map((s: any) => ({
          live_trip_id: tripId,
          registration_id: s.registration_id,
          notification_type: "trip_completed",
          title: "انتهت الرحلة",
          message: "تم توصيل الطلاب بنجاح",
        })),
      );
    }

    return json({ trip: completed, existed: false });
  } catch (e) {
    return json({ code: "UNEXPECTED", error: (e as Error).message }, 500);
  }
});
