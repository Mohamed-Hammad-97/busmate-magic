import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  phone: string;
}

const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone }: SendOtpRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - remove spaces and ensure it starts with country code
    const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
    const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+2${cleanPhone}`;
    
    // For CEQUENS, we need the number without + prefix
    const cequensPhone = formattedPhone.replace("+", "");

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Store OTP in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete any existing OTP for this phone
    await supabase
      .from("otp_codes")
      .delete()
      .eq("phone", cleanPhone);

    // Insert new OTP
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        phone: cleanPhone,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via CEQUENS
    const cequensApiToken = Deno.env.get("CEQUENS_API_TOKEN");
    const senderName = Deno.env.get("CEQUENS_SENDER_NAME") || "Seater";

    if (!cequensApiToken) {
      console.error("CEQUENS_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsPayload = {
      senderName: senderName,
      messageType: "text",
      messageText: `رمز التحقق الخاص بك هو: ${otp}\nصالح لمدة 5 دقائق`,
      recipients: cequensPhone,
    };

    console.log("Sending SMS to:", cequensPhone);

    const smsResponse = await fetch("https://apis.cequens.com/sms/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cequensApiToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(smsPayload),
    });

    const smsResult = await smsResponse.json();
    console.log("CEQUENS response:", JSON.stringify(smsResult));

    if (!smsResponse.ok) {
      console.error("CEQUENS SMS failed:", smsResult);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-otp:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
