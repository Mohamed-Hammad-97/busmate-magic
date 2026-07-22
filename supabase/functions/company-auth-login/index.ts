import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { verifyPassword } from "../_shared/password-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find company account
    const { data: account, error: fetchError } = await supabase
      .from("company_accounts")
      .select("*, companies(id, name, city, is_active, logo_url)")
      .eq("email", email.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError || !account) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.companies?.is_active) {
      return new Response(
        JSON.stringify({ error: "Company account is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, account.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a simple JWT token for company portal
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not configured");
    }

    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(JSON.stringify({
      sub: account.id,
      company_id: account.company_id,
      role: account.role,
      permissions: account.permissions,
      email: account.email,
      full_name: account.full_name,
      company_name: account.companies.name,
      iat: now,
      exp: now + 86400, // 24 hours
    }));

    // HMAC-SHA256 signing
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const token = `${header}.${payload}.${sig}`;

    return new Response(
      JSON.stringify({
        success: true,
        token,
        account: {
          id: account.id,
          email: account.email,
          full_name: account.full_name,
          phone: account.phone,
          role: account.role,
          permissions: account.permissions,
          company_id: account.company_id,
          company_name: account.companies.name,
          company_city: account.companies.city,
          company_logo_url: account.companies.logo_url || null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in company-auth-login:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
