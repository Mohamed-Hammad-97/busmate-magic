import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizePhone, resolveParentFamily } from "../_shared/parent-family.ts";
import { hashPassword } from "../_shared/password-utils.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Not authorized" }, 401);

    const { phone, password } = await req.json();
    const cleanPhone = normalizePhone(String(phone ?? ""));

    if (!/^1\d{9}$/.test(cleanPhone)) {
      return json({ error: "رقم الهاتف غير صحيح" }, 400);
    }
    if (
      typeof password !== "string" || password.length < 8 ||
      !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)
    ) {
      return json({ error: "كلمة المرور غير مطابقة للمتطلبات" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(
      token,
    );
    const userId = userData?.user?.id;
    if (userError || !userId) return json({ error: "Not authorized" }, 401);

    // The phone must belong to the signed-in parent's own family.
    const family = await resolveParentFamily(supabase, cleanPhone);

    const { data: callerRow } = await supabase
      .from("parent_accounts")
      .select("family_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const callerFamilyId = callerRow?.family_id ?? null;

    const owned = family.rows.some((r) => r.user_id === userId) ||
      (!!callerFamilyId &&
        family.rows.some((r) => r.family_id === callerFamilyId));

    if (!owned) return json({ error: "Not authorized" }, 403);

    const target = family.rows.find((r) => r.user_id === userId) ??
      family.rows[0];

    const { error: upsertError } = await supabase
      .from("parent_phone_credentials")
      .upsert({
        phone_normalized: cleanPhone,
        family_id: target?.family_id ?? null,
        parent_account_id: target?.id ?? null,
        password_hash: await hashPassword(password),
      }, { onConflict: "phone_normalized" });

    if (upsertError) {
      console.error("Error saving password:", upsertError);
      return json({ error: "Failed to save password" }, 500);
    }

    if (target?.id) {
      await supabase.from("parent_accounts").update({ has_password: true }).eq(
        "id",
        target.id,
      );
    }

    return json({ success: true });
  } catch (error: unknown) {
    console.error("Error in set-parent-password:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
