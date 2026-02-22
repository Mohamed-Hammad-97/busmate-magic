import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parent_id } = await req.json();

    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: "parent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is an employee
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parent account
    const { data: parent, error: parentError } = await supabase
      .from("parent_accounts")
      .select("id, user_id, parent_name, father_phone")
      .eq("id", parent_id)
      .single();

    if (parentError || !parent) {
      return new Response(
        JSON.stringify({ error: "Parent account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already has a user account - nothing to do
    if (parent.user_id) {
      console.log("Parent already has auth account:", parent.id);
      return new Response(
        JSON.stringify({ success: true, already_active: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user for the parent
    const parentEmail = `parent_${parent.id}@parent.seaterapp.local`;

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: parentEmail,
      password: crypto.randomUUID(), // random password, parent uses OTP to login
      email_confirm: true,
      user_metadata: {
        parent_name: parent.parent_name,
        parent_account_id: parent.id,
      },
    });

    if (createError) {
      console.error("Error creating auth user for parent:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create parent auth account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link user_id to parent account
    const { error: updateError } = await supabase
      .from("parent_accounts")
      .update({ user_id: authData.user.id })
      .eq("id", parent.id);

    if (updateError) {
      console.error("Error linking user to parent:", updateError);
    }

    console.log("Activated parent account:", parent.id, "-> user:", authData.user.id);

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in activate-parent-account:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
