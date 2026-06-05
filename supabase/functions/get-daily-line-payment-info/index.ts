import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of keys safe to expose to anonymous booking visitors
const PUBLIC_KEYS = [
  "instapay_account_name",
  "instapay_ipa",
  "instapay_bank_name",
  "whatsapp_number",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("daily_line_settings")
      .select("key, value")
      .in("key", PUBLIC_KEYS);

    if (error) throw error;

    const settings: Record<string, string> = {};
    (data ?? []).forEach((row: { key: string; value: string | null }) => {
      settings[row.key] = row.value ?? "";
    });

    return new Response(JSON.stringify({ settings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-daily-line-payment-info error:", e);
    return new Response(JSON.stringify({ error: "Failed to load payment info" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
