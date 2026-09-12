import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  hasCurrentRegistration,
  normalizePhone,
  resolveParentFamily,
  unifyFamilyId,
} from "../_shared/parent-family.ts";
import { hashPassword, verifyPassword } from "../_shared/password-utils.ts";

const OTP_FALLBACK = {
  error:
    "تعذر تسجيل الدخول بكلمة المرور. استخدم رمز التحقق للدخول أو إعادة تعيين كلمة المرور",
  needs_otp: true,
};

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
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return json({ error: "Phone and password are required" }, 400);
    }

    const cleanPhone = normalizePhone(String(phone));
    if (!/^1\d{9}$/.test(cleanPhone)) {
      return json(OTP_FALLBACK);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve the family so any of its numbers reaches the same account,
    // while the password itself belongs to the entered number only.
    const family = await resolveParentFamily(supabase, cleanPhone);
    await unifyFamilyId(supabase, family);

    const loginRow =
      family.rows.find((r) => r.user_id && r.id === family.primary?.id) ??
      family.rows.find((r) => r.user_id) ??
      null;

    if (!loginRow?.user_id) {
      return json(OTP_FALLBACK);
    }

    const familyHasRegistration = family.rows.some(hasCurrentRegistration);
    const anyActive = family.rows.some((r) => r.is_active !== false);
    if (!anyActive && !familyHasRegistration) {
      return json({ error: "تم تعطيل هذا الحساب. تواصل مع الإدارة" }, 403);
    }

    // 1) Per-phone credential (the new, per-parent password)
    const { data: credential } = await supabase
      .from("parent_phone_credentials")
      .select("id, password_hash")
      .eq("phone_normalized", cleanPhone)
      .maybeSingle();

    let authorized = false;

    if (credential?.password_hash) {
      authorized = await verifyPassword(password, credential.password_hash);
    } else {
      // 2) Legacy fallback: the family's shared Supabase Auth password.
      // On success it becomes this number's own password.
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ||
          Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      );

      for (const candidate of family.rows.filter((r) => r.user_id)) {
        const { data: userData } = await supabase.auth.admin.getUserById(
          candidate.user_id!,
        );
        const email = userData?.user?.email;
        if (!email) continue;

        const { data: signInData } = await anonClient.auth.signInWithPassword({
          email,
          password,
        });
        if (signInData?.session) {
          authorized = true;
          await supabase.from("parent_phone_credentials").upsert(
            {
              phone_normalized: cleanPhone,
              family_id: candidate.family_id,
              parent_account_id: candidate.id,
              password_hash: await hashPassword(password),
            },
            { onConflict: "phone_normalized" },
          );
          await anonClient.auth.signOut();
          break;
        }
      }
    }

    if (!authorized) {
      return json(OTP_FALLBACK);
    }

    // Mint a session for the family's single login without touching the
    // shared Auth password.
    const { data: userData } = await supabase.auth.admin.getUserById(
      loginRow.user_id,
    );
    const email = userData?.user?.email;
    if (!email) return json(OTP_FALLBACK);

    const { data: linkData, error: linkError } = await supabase.auth.admin
      .generateLink({ type: "magiclink", email });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("Error preparing session:", linkError);
      return json({ error: "Failed to establish session" }, 500);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ||
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    );

    const { data: sessionData, error: sessionError } = await anonClient.auth
      .verifyOtp({ token_hash: tokenHash, type: "email" });

    if (sessionError || !sessionData.session) {
      console.error("Error establishing session:", sessionError);
      return json({ error: "Failed to establish session" }, 500);
    }

    // Repair stale flags on the record that owns the login
    if (loginRow.is_active === false) {
      await supabase.from("parent_accounts").update({ is_active: true }).eq(
        "id",
        loginRow.id,
      );
    }
    if (!loginRow.has_password) {
      await supabase.from("parent_accounts").update({ has_password: true }).eq(
        "id",
        loginRow.id,
      );
    }

    return json({
      success: true,
      user_id: loginRow.user_id,
      parent_account_id: loginRow.id,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        token_type: sessionData.session.token_type,
      },
    });
  } catch (error: unknown) {
    console.error("Error in parent-password-login:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
