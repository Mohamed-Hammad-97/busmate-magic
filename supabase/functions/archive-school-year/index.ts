import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is a super_admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check super_admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only super admins can archive school years" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Archive all non-archived registrations (set status to 'archived')
    const { data: archivedRegs, error: regError } = await adminClient
      .from("registrations")
      .update({ status: "archived" })
      .neq("status", "archived")
      .neq("status", "cancelled")
      .select("id");

    if (regError) throw regError;
    const archivedCount = archivedRegs?.length || 0;
    const archivedRegIds = (archivedRegs || []).map((r: any) => r.id);

    // 1b. Archive unpaid payments tied to the archived registrations' subscriptions
    let archivedPaymentsCount = 0;
    if (archivedRegIds.length > 0) {
      const { data: subs, error: subsError } = await adminClient
        .from("subscriptions")
        .select("id")
        .in("registration_id", archivedRegIds);
      if (subsError) throw subsError;

      const subIds = (subs || []).map((s: any) => s.id);
      if (subIds.length > 0) {
        const { data: archivedPayments, error: payError } = await adminClient
          .from("payments")
          .update({ status: "archived" })
          .in("subscription_id", subIds)
          .in("status", ["pending", "overdue"])
          .select("id");
        if (payError) throw payError;
        archivedPaymentsCount = archivedPayments?.length || 0;
      }
    }

    // 2. Deactivate all routes
    const { data: archivedRoutes, error: routeError } = await adminClient
      .from("routes")
      .update({ is_active: false })
      .eq("is_active", true)
      .select("id");

    if (routeError) throw routeError;
    const routesCount = archivedRoutes?.length || 0;

    // 3. Delete all route assignments (they belong to old year)
    const { error: assignError } = await adminClient
      .from("route_assignments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

    if (assignError) throw assignError;

    // 4. Deactivate parent accounts (they need to re-register)
    const { error: parentError } = await adminClient
      .from("parent_accounts")
      .update({ is_active: false })
      .eq("is_active", true);

    if (parentError) throw parentError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "School year archived successfully",
        stats: {
          registrations_archived: archivedCount,
          payments_archived: archivedPaymentsCount,
          routes_deactivated: routesCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Archive error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
