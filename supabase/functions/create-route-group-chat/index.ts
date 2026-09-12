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
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Staff only
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    if (!roleRow) return json({ error: "Staff access required" }, 403);

    const { data: employee } = await admin
      .from("employees").select("id").eq("user_id", userId).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const routeId = body?.routeId as string | undefined;
    if (!routeId) return json({ error: "routeId is required" }, 400);

    const { data: route } = await admin
      .from("routes").select("id, name, supervisor_id").eq("id", routeId).maybeSingle();
    if (!route) return json({ error: "Route not found" }, 404);

    // Idempotent: reuse an existing group for this line
    const { data: existing } = await admin
      .from("unified_conversations")
      .select("id").eq("type", "route_group").eq("route_id", routeId).limit(1).maybeSingle();
    if (existing) return json({ conversation_id: existing.id, existed: true });

    const { data: conv, error: convErr } = await admin
      .from("unified_conversations")
      .insert({
        type: "route_group",
        route_id: routeId,
        subject: `${route.name} - Group Chat`,
        allow_customer_messages: false,
        created_by: userId,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (convErr) throw convErr;

    const participants: Record<string, unknown>[] = [{
      conversation_id: conv.id,
      user_id: userId,
      participant_type: "employee",
      participant_ref_id: employee?.id ?? null,
      can_send: true,
    }];
    const added = new Set<string>([userId]);

    if (route.supervisor_id) {
      const { data: supAccount } = await admin
        .from("driver_accounts").select("user_id")
        .eq("supervisor_id", route.supervisor_id).eq("is_active", true).maybeSingle();
      if (supAccount?.user_id && !added.has(supAccount.user_id)) {
        added.add(supAccount.user_id);
        participants.push({
          conversation_id: conv.id,
          user_id: supAccount.user_id,
          participant_type: "supervisor",
          participant_ref_id: route.supervisor_id,
          can_send: true,
        });
      }
    }

    const { data: assignments } = await admin
      .from("route_assignments")
      .select("registrations(parent_id, parent_accounts(id, user_id))")
      .eq("route_id", routeId);

    for (const a of assignments ?? []) {
      const parent = (a as any).registrations?.parent_accounts;
      if (parent?.user_id && !added.has(parent.user_id)) {
        added.add(parent.user_id);
        participants.push({
          conversation_id: conv.id,
          user_id: parent.user_id,
          participant_type: "parent",
          participant_ref_id: parent.id,
          can_send: false,
        });
      }
    }

    const { error: partErr } = await admin.from("conversation_participants").insert(participants);
    if (partErr) throw partErr;

    return json({ conversation_id: conv.id, members: participants.length });
  } catch (e) {
    console.error("create-route-group-chat error:", e);
    return json({ error: "Failed to create group chat" }, 500);
  }
});
