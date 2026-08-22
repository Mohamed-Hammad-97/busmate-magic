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
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return new Response(
        JSON.stringify({ error: "Phone and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "").replace(/^\+2/, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find parent account (has_password flag can be stale, so don't gate on it)
    const { data: parents, error: parentError } = await supabase
      .from("parent_accounts")
      .select("id, user_id, has_password, is_active")
      .or(`father_phone.eq.${cleanPhone},father_phone.eq.0${cleanPhone}`)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const parent = parents?.[0];

    if (parentError || !parent?.user_id) {
      console.log("Parent lookup failed", { hasError: !!parentError, found: parents?.length ?? 0 });
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Block deactivated accounts
    if (parent.is_active === false) {
      return new Response(
        JSON.stringify({ error: "تم تعطيل هذا الحساب. تواصل مع الإدارة" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(parent.user_id);
    if (!userData?.user?.email) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sign in with password using anon client
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
    );

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: userData.user.email,
      password: password,
    });

    if (signInError || !signInData.session) {
      console.error("Password login failed:", signInError);
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Keep the flag in sync (client-side updates can be blocked by RLS)
    if (!parent.has_password) {
      await supabase.from("parent_accounts").update({ has_password: true }).eq("id", parent.id);
    }



    return new Response(
      JSON.stringify({
        success: true,
        user_id: parent.user_id,
        parent_account_id: parent.id,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_in: signInData.session.expires_in,
          token_type: signInData.session.token_type,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in parent-password-login:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
