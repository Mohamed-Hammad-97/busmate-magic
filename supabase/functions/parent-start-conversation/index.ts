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

    // --- Auth ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // --- Parent account ---
    const { data: parent } = await admin
      .from("parent_accounts")
      .select("id, parent_name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!parent) return json({ error: "Parent account not found" }, 403);

    const body = await req.json().catch(() => ({}));
    const target = body?.target as string | undefined;

    if (target === "targets") {
      // List available supervisors for this parent (one per line)
      const { data: rows } = await admin
        .from("route_assignments")
        .select(
          "registrations!inner(id, student_name, parent_id, status), routes!inner(id, name, route_number, supervisor_id, supervisors(id, full_name))",
        )
        .eq("registrations.parent_id", parent.id)
        .eq("registrations.status", "complete");

      const seen = new Set<string>();
      const supervisors: any[] = [];
      for (const r of rows ?? []) {
        const route: any = (r as any).routes;
        const reg: any = (r as any).registrations;
        const sup = route?.supervisors;
        if (!sup?.id || seen.has(sup.id)) continue;
        seen.add(sup.id);
        supervisors.push({
          supervisor_id: sup.id,
          supervisor_name: sup.full_name,
          route_id: route.id,
          route_name: route.name,
          route_number: route.route_number,
          student_name: reg?.student_name,
        });
      }
      return json({ supervisors });
    }

    if (target === "support") {
      // Reuse existing support conversation for this parent
      const { data: myConvs } = await admin
        .from("conversation_participants")
        .select("conversation_id, unified_conversations!inner(id, type)")
        .eq("user_id", userId)
        .eq("unified_conversations.type", "customer_support");

      if (myConvs && myConvs.length > 0) {
        return json({ conversation_id: myConvs[0].conversation_id });
      }

      const { data: conv, error: convErr } = await admin
        .from("unified_conversations")
        .insert({
          type: "customer_support",
          subject: `دعم العملاء - ${parent.parent_name}`,
          created_by: userId,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (convErr) throw convErr;

      await admin.from("conversation_participants").insert({
        conversation_id: conv.id,
        user_id: userId,
        participant_type: "parent",
        participant_ref_id: parent.id,
        can_send: true,
      });

      return json({ conversation_id: conv.id });
    }

    if (target === "supervisor") {
      const supervisorId = body?.supervisor_id as string | undefined;
      if (!supervisorId) return json({ error: "supervisor_id is required" }, 400);

      // Verify this supervisor really serves one of the parent's children
      const { data: allowed } = await admin
        .from("route_assignments")
        .select("id, registrations!inner(parent_id, status), routes!inner(supervisor_id)")
        .eq("registrations.parent_id", parent.id)
        .eq("registrations.status", "complete")
        .eq("routes.supervisor_id", supervisorId)
        .limit(1);

      if (!allowed || allowed.length === 0) {
        return json({ error: "Supervisor not linked to your account" }, 403);
      }

      const { data: supervisor } = await admin
        .from("supervisors")
        .select("id, full_name")
        .eq("id", supervisorId)
        .maybeSingle();

      const { data: supAccount } = await admin
        .from("driver_accounts")
        .select("user_id")
        .eq("supervisor_id", supervisorId)
        .eq("is_active", true)
        .maybeSingle();

      // Reuse existing private conversation with this supervisor
      const { data: myConvs } = await admin
        .from("conversation_participants")
        .select("conversation_id, unified_conversations!inner(id, type)")
        .eq("user_id", userId)
        .eq("unified_conversations.type", "customer_supervisor");

      const convIds = (myConvs ?? []).map((c: any) => c.conversation_id);
      if (convIds.length > 0) {
        const { data: matches } = await admin
          .from("conversation_participants")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .eq("participant_type", "supervisor")
          .eq("participant_ref_id", supervisorId)
          .limit(1);
        if (matches && matches.length > 0) {
          return json({ conversation_id: matches[0].conversation_id });
        }
      }

      const { data: conv, error: convErr } = await admin
        .from("unified_conversations")
        .insert({
          type: "customer_supervisor",
          subject: `${parent.parent_name} - ${supervisor?.full_name ?? "المشرف"}`,
          created_by: userId,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (convErr) throw convErr;

      const participants: any[] = [
        {
          conversation_id: conv.id,
          user_id: userId,
          participant_type: "parent",
          participant_ref_id: parent.id,
          can_send: true,
        },
      ];
      if (supAccount?.user_id) {
        participants.push({
          conversation_id: conv.id,
          user_id: supAccount.user_id,
          participant_type: "supervisor",
          participant_ref_id: supervisorId,
          can_send: true,
        });
      } else {
        participants.push({
          conversation_id: conv.id,
          user_id: null,
          participant_type: "supervisor",
          participant_ref_id: supervisorId,
          can_send: true,
        });
      }
      await admin.from("conversation_participants").insert(participants);

      return json({ conversation_id: conv.id });
    }

    return json({ error: "Invalid target" }, 400);
  } catch (e) {
    console.error("parent-start-conversation error:", e);
    return json({ error: "Failed to start conversation" }, 500);
  }
});
