import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  phone: string;
  code: string;
}

const MAX_ATTEMPTS = 5;
const GENERIC_ERROR = "Verification failed. Please check the code and try again.";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code }: VerifyOtpRequest = await req.json();

    if (!phone || !code || typeof phone !== "string" || typeof code !== "string" || code.length > 10 || phone.length > 20) {
      return new Response(
        JSON.stringify({ error: "Phone and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "").replace(/^\+2/, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up active OTP record for this phone (regardless of code) to enforce attempts
    const { data: activeOtp } = await supabase
      .from("otp_codes")
      .select("id, code, attempts, expires_at, verified")
      .eq("phone", cleanPhone)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeOtp) {
      return new Response(
        JSON.stringify({ error: GENERIC_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block if too many attempts already
    if ((activeOtp.attempts ?? 0) >= MAX_ATTEMPTS) {
      // Invalidate to force a new OTP request
      await supabase.from("otp_codes").update({ verified: true }).eq("id", activeOtp.id);
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please request a new code." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check code (constant-time-ish via length-equal compare)
    const codeOk = activeOtp.code.length === code.length && activeOtp.code === code;

    if (!codeOk) {
      const newAttempts = (activeOtp.attempts ?? 0) + 1;
      await supabase
        .from("otp_codes")
        .update({ attempts: newAttempts })
        .eq("id", activeOtp.id);
      return new Response(
        JSON.stringify({ error: GENERIC_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP verified
    await supabase.from("otp_codes").update({ verified: true }).eq("id", activeOtp.id);

    // Find parent account by father's OR mother's phone (any stored format)
    const phoneVariants = [cleanPhone, `0${cleanPhone}`, `20${cleanPhone}`, `+20${cleanPhone}`];
    const orFilter = [
      ...phoneVariants.map((p) => `father_phone.eq.${p}`),
      ...phoneVariants.map((p) => `mother_phone.eq.${p}`),
    ].join(",");

    const { data: parentAccounts, error: parentError } = await supabase
      .from("parent_accounts")
      .select("id, user_id, parent_name, father_phone")
      .or(orFilter)
      .order("created_at", { ascending: false });

    const parentAccount = parentAccounts?.find((p) => p.user_id) ?? parentAccounts?.[0];


    if (parentError || !parentAccount) {
      // Use a generic message to avoid phone enumeration
      return new Response(
        JSON.stringify({ error: GENERIC_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentEmail = `parent_${parentAccount.id}@parent.seaterapp.local`;
    const tempPassword = crypto.randomUUID();

    let userId = parentAccount.user_id;

    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: parentEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          parent_name: parentAccount.parent_name,
          parent_account_id: parentAccount.id,
        },
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authData.user.id;

      await supabase
        .from("parent_accounts")
        .update({ user_id: userId })
        .eq("id", parentAccount.id);
    } else {
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });

      if (updateError) {
        console.error("Error updating user password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to prepare login" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await supabase.from("otp_codes").delete().eq("id", activeOtp.id);

    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email || parentEmail;

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
    );

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: userEmail,
      password: tempPassword,
    });

    if (signInError || !signInData.session) {
      console.error("Error signing in:", signInError);
      return new Response(
        JSON.stringify({ error: "Failed to establish session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        user_id: userId,
        parent_account_id: parentAccount.id,
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
    console.error("Error in verify-otp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
