import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  tripId: z.string().uuid(),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ code: "SESSION_EXPIRED", error: "Unauthorized" }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ code: "SESSION_EXPIRED", error: "Unauthorized" }, 401);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ code: "BAD_REQUEST", error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { tripId, lat, lng } = parsed.data;
    const { data: trip, error: tripError } = await admin
      .from("live_trips")
      .select("id, route_id, status")
      .eq("id", tripId)
      .maybeSingle();

    if (tripError) return json({ code: "LOOKUP_FAILED", error: tripError.message }, 500);
    if (!trip) return json({ code: "NOT_FOUND", error: "Trip not found" }, 404);
    if (trip.status !== "in_progress") {
      return json({ code: "TRIP_NOT_ACTIVE", error: "Trip is not active" }, 409);
    }

    const { data: allowed, error: permissionError } = await admin.rpc("can_start_route_trip", {
      _user_id: userData.user.id,
      _route_id: trip.route_id,
    });

    if (permissionError) return json({ code: "PERMISSION_CHECK_FAILED", error: permissionError.message }, 500);
    if (!allowed) return json({ code: "NOT_ASSIGNED", error: "Not assigned to this route" }, 403);

    const updatedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("live_trips")
      .update({
        current_latitude: lat,
        current_longitude: lng,
        last_location_update: updatedAt,
      })
      .eq("id", tripId)
      .eq("status", "in_progress")
      .select("id, current_latitude, current_longitude, last_location_update")
      .maybeSingle();

    if (updateError || !updated) {
      return json({ code: "UPDATE_FAILED", error: updateError?.message ?? "Location was not saved" }, 500);
    }

    return json({ location: updated });
  } catch (error) {
    return json({ code: "UNEXPECTED", error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});