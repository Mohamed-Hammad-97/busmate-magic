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

    const cleanPhone = String(phone).replace(/\D/g, "").replace(/^20/, "").replace(/^0/, "");

    if (!/^1\d{9}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find parent account (has_password flag can be stale, so don't gate on it).
    // Accept the father's OR the mother's phone in any stored format.
    const phoneVariants = [cleanPhone, `0${cleanPhone}`, `20${cleanPhone}`, `+20${cleanPhone}`];
    const orFilter = [
      ...phoneVariants.map((p) => `father_phone.eq.${p}`),
      ...phoneVariants.map((p) => `mother_phone.eq.${p}`),
    ].join(",");

    const { data: parents, error: parentError } = await supabase
      .from("parent_accounts")
      .select("id, user_id, has_password, is_active, registrations(status)")
      .or(orFilter)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false });


    // A current registration is also proof that the account should be active.
    // This repairs legacy rows deactivated during school-year archival or sibling cancellation.
    const hasCurrentRegistration = (candidate: typeof parents extends (infer T)[] | null ? T : never) =>
      candidate.registrations?.some((registration) =>
        registration.status === "pending_fees" || registration.status === "complete"
      ) ?? false;
    const parent = parents?.find((candidate) => candidate.is_active !== false)
      ?? parents?.find(hasCurrentRegistration)
      ?? parents?.[0];


    if (parentError || !parent?.user_id) {
      console.log("Parent lookup failed", { hasError: !!parentError, found: parents?.length ?? 0 });
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Block genuinely deactivated accounts, but repair a stale flag when a current
    // registration exists so an active subscription can still be accessed.
    if (parent.is_active === false && !hasCurrentRegistration(parent)) {
      return new Response(
        JSON.stringify({ error: "تم تعطيل هذا الحساب. تواصل مع الإدارة" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (parent.is_active === false) {
      const { error: reactivateError } = await supabase
        .from("parent_accounts")
        .update({ is_active: true })
        .eq("id", parent.id);

      if (reactivateError) {
        console.error("Failed to repair parent active state", { parentId: parent.id });
        return new Response(
          JSON.stringify({ error: "تعذر تفعيل الحساب. تواصل مع الإدارة" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
