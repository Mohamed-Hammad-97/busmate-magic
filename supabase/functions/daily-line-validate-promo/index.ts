import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase().slice(0, 50) : "";
    if (!code) return json({ valid: false, reason: "empty" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: promo } = await admin
      .from("daily_line_promocodes")
      .select("promo_type, value, max_uses, used_count, expires_at, is_active")
      .eq("code", code)
      .maybeSingle();

    if (!promo || !promo.is_active) return json({ valid: false, reason: "invalid" });
    if (promo.expires_at && promo.expires_at < new Date().toISOString().slice(0, 10))
      return json({ valid: false, reason: "expired" });
    if (promo.max_uses != null && promo.used_count >= promo.max_uses)
      return json({ valid: false, reason: "used_up" });

    return json({ valid: true, code, promo_type: promo.promo_type, value: Number(promo.value) });
  } catch (e) {
    console.error(e);
    return json({ valid: false, reason: "error" }, 500);
  }
});
