import { getRdsClient } from "../_shared/rds-client.ts";
import { verifyPassword } from "../_shared/password-utils.ts";
import { generateTokens } from "../_shared/jwt-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone, password }: LoginRequest = await req.json();

    if ((!email && !phone) || !password) {
      return new Response(
        JSON.stringify({ error: "Email or phone, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = getRdsClient();

    // Find user by email or phone
    let user;
    if (email) {
      const result = await sql`
        SELECT id, email, password_hash, full_name, phone
        FROM auth_users
        WHERE email = ${email.toLowerCase()}
      `;
      user = result[0];
    } else if (phone) {
      const cleanPhone = phone.replace(/\s/g, "").replace(/^0/, "");
      const result = await sql`
        SELECT id, email, password_hash, full_name, phone
        FROM auth_users
        WHERE phone = ${cleanPhone} OR phone = ${'0' + cleanPhone}
      `;
      user = result[0];
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user role
    const roleResult = await sql`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    const role = roleResult[0]?.role || null;

    // Get employee data if applicable
    let employee = null;
    if (role) {
      const empResult = await sql`
        SELECT id, full_name, email, phone, departments, is_active
        FROM employees
        WHERE user_id = ${user.id}
      `;
      employee = empResult[0] || null;
    }

    // Generate JWT tokens
    const tokens = await generateTokens(user.id, user.email, user.phone, role);

    // Update last login
    await sql`
      UPDATE auth_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}
    `;

    console.log("User logged in successfully:", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
        },
        role,
        employee,
        ...tokens,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in rds-auth-login:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
