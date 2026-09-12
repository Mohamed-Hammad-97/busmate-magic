import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  hasCurrentRegistration,
  normalizePhone,
  resolveParentFamily,
  unifyFamilyId,
} from "../_shared/parent-family.ts";

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

    const cleanPhone = normalizePhone(String(phone));

    if (!/^1\d{9}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve the whole family for this number (father's or mother's) so every
    // number of the same family reaches the same login.
    const family = await resolveParentFamily(supabase, cleanPhone);
    await unifyFamilyId(supabase, family);

    // Candidate logins of the family: the preferred one first, then the rest.
    const candidates = [
      ...(family.primary?.user_id ? [family.primary] : []),
      ...family.rows.filter((r) => r.user_id && r.id !== family.primary?.id),
    ];

    if (candidates.length === 0) {
      console.log("Parent lookup failed", { found: family.rows.length });
      return new Response(JSON.stringify({
        error: "تعذر تسجيل الدخول بكلمة المرور. استخدم رمز التحقق للدخول أو إعادة تعيين كلمة المرور",
        needs_otp: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Block genuinely deactivated accounts, but repair a stale flag when a current
    // registration exists so an active subscription can still be accessed.
    const familyHasRegistration = family.rows.some(hasCurrentRegistration);
    const anyActive = candidates.some((r) => r.is_active !== false);
    if (!anyActive && !familyHasRegistration) {
      return new Response(
        JSON.stringify({ error: "تم تعطيل هذا الحساب. تواصل مع الإدارة" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
    );

    // The password belongs to whichever family record the parent originally set it
    // on, so try every login of the family until one matches.
    let parent: typeof candidates[number] | null = null;
    let session: { access_token: string; refresh_token: string; expires_in: number; token_type: string } | null = null;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      const { data: userData } = await supabase.auth.admin.getUserById(candidate.user_id!);
      const email = userData?.user?.email;
      if (!email) continue;

      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData?.session) {
        lastError = signInError;
        continue;
      }

      parent = candidate;
      session = {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_in: signInData.session.expires_in,
        token_type: signInData.session.token_type,
      };
      break;
    }

    if (!parent || !session) {
      console.error("Password login failed for family", {
        candidates: candidates.length,
        lastError,
      });

      // The saved-password marker may be stale (legacy OTP sign-in previously
      // replaced passwords). Clear it so verified OTP login prompts the parent
      // to choose a fresh password without blocking valid future attempts.
      const candidateIds = candidates.map((candidate) => candidate.id);
      if (candidateIds.length > 0) {
        await supabase
          .from("parent_accounts")
          .update({ has_password: false })
          .in("id", candidateIds);
      }

      return new Response(JSON.stringify({
        error: "تعذر تسجيل الدخول بكلمة المرور. استخدم رمز التحقق للدخول أو إعادة تعيين كلمة المرور",
        needs_otp: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Repair stale flags on the record that actually signed in
    if (parent.is_active === false) {
      await supabase.from("parent_accounts").update({ is_active: true }).eq("id", parent.id);
    }
    if (!parent.has_password) {
      await supabase.from("parent_accounts").update({ has_password: true }).eq("id", parent.id);
    }




    return new Response(
      JSON.stringify({
        success: true,
        user_id: parent.user_id,
        parent_account_id: parent.id,
        session,
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
