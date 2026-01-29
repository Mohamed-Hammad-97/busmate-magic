import { getRdsClient } from "../_shared/rds-client.ts";
import { hashPassword } from "../_shared/password-utils.ts";
import { generateTokens } from "../_shared/jwt-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, full_name, phone }: SignupRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = getRdsClient();

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth_users WHERE email = ${email.toLowerCase()}
    `;

    if (existingUser.length > 0) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await sql`
      INSERT INTO auth_users (id, email, password_hash, full_name, phone, created_at, updated_at)
      VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${full_name || null}, ${phone || null}, NOW(), NOW())
    `;

    // Generate JWT tokens
    const tokens = await generateTokens(userId, email.toLowerCase(), phone);

    console.log("User created successfully:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: email.toLowerCase(),
          full_name: full_name || null,
          phone: phone || null,
        },
        ...tokens,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in rds-auth-signup:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
