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

    // Check if parent already has a user account
    let userId = parentAccount.user_id;

    if (!userId) {
      // Create a new auth user for this parent using phone
      const formattedPhone = `+2${cleanPhone.replace(/^0/, "")}`;
      
      // Create user with a random password (they'll use OTP to login)
      const tempPassword = crypto.randomUUID();
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirm: true,
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
    }

    // Delete used OTP
    await supabase
      .from("otp_codes")
      .delete()
      .eq("id", otpRecord.id);

    // Generate a magic link for seamless login
    const tempEmail = `parent_${parentAccount.id}@parent.seaterapp.local`;
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: tempEmail,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_URL")}/auth/v1/callback`,
      },
    });

    if (linkError) {
      console.error("Error generating link:", linkError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        user_id: userId,
        parent_account_id: parentAccount.id,
        token: linkData?.properties?.hashed_token,
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
