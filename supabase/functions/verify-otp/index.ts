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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code }: VerifyOtpRequest = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "Phone and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "").replace(/^\+2/, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otpError || !otpRecord) {
      console.log("OTP verification failed for phone:", cleanPhone, "Error:", otpError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Find parent account by phone
    const { data: parentAccount, error: parentError } = await supabase
      .from("parent_accounts")
      .select("id, user_id, parent_name, father_phone")
      .or(`father_phone.eq.${cleanPhone},father_phone.eq.0${cleanPhone}`)
      .single();

    if (parentError || !parentAccount) {
      console.log("Parent account not found for phone:", cleanPhone);
      return new Response(
        JSON.stringify({ error: "No account found with this phone number" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a stable email for this parent
    const parentEmail = `parent_${parentAccount.id}@parent.seaterapp.local`;
    const tempPassword = crypto.randomUUID();

    // Check if parent already has a user account
    let userId = parentAccount.user_id;

    if (!userId) {
      // Create a new auth user for this parent
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

      // Link user to parent account
      await supabase
        .from("parent_accounts")
        .update({ user_id: userId })
        .eq("id", parentAccount.id);
      
      console.log("Created new auth user for parent:", parentAccount.id, "userId:", userId);
    } else {
      // User exists, update password so we can sign in
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

      // Get the user's email (it might have been set differently)
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        // Use existing email
      }
    }

    // Delete used OTP
    await supabase
      .from("otp_codes")
      .delete()
      .eq("id", otpRecord.id);

    // Sign in to get a real session
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email || parentEmail;

    // Use signInWithPassword via a separate client with anon key to generate real tokens
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

    console.log("OTP verified and session created for parent:", parentAccount.id);

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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
