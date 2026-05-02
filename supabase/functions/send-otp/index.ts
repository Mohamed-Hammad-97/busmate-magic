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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone }: SendOtpRequest = await req.json();

    if (!phone || typeof phone !== "string" || phone.length > 20) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
    const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+20${cleanPhone}`;
    const cequensPhone = formattedPhone.replace("+", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: max 3 OTP requests per phone per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentRequests } = await supabase
      .from("otp_codes")
      .select("created_at")
      .eq("phone", cleanPhone)
      .gte("created_at", tenMinutesAgo);

    if (recentRequests && recentRequests.length >= 3) {
      console.log("Rate limit hit for phone:", cleanPhone);
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please wait before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cooldown: min 30 seconds between requests for same phone
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: lastRequest } = await supabase
      .from("otp_codes")
      .select("created_at")
      .eq("phone", cleanPhone)
      .gte("created_at", thirtySecondsAgo)
      .limit(1)
      .maybeSingle();

    if (lastRequest) {
      return new Response(
        JSON.stringify({ error: "Please wait a few seconds before requesting another code." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete any existing OTP for this phone
    await supabase.from("otp_codes").delete().eq("phone", cleanPhone);

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

    if (!smsResponse.ok) {
      console.error("CEQUENS SMS failed:", smsResult);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
