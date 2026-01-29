import { verifyToken } from "../_shared/jwt-utils.ts";
import { getRdsClient } from "../_shared/rds-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = await verifyToken(token);

    if (!payload || payload.type !== "access") {
      return new Response(
        JSON.stringify({ error: "Invalid or expired access token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = getRdsClient();

    // Get full user data
    const userResult = await sql`
      SELECT id, email, phone, full_name, created_at, last_login_at
      FROM auth_users
      WHERE id = ${payload.sub}
    `;

    const user = userResult[0];
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Get driver/supervisor account if applicable
    let driverAccount = null;
    const driverResult = await sql`
      SELECT id, driver_id, supervisor_id, phone, is_active
      FROM driver_accounts
      WHERE user_id = ${user.id} AND is_active = true
    `;
    driverAccount = driverResult[0] || null;

    // Get parent account if applicable
    let parentAccount = null;
    const parentResult = await sql`
      SELECT id, parent_name, father_phone, city
      FROM parent_accounts
      WHERE user_id = ${user.id}
    `;
    parentAccount = parentResult[0] || null;

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          created_at: user.created_at,
          last_login_at: user.last_login_at,
        },
        role,
        employee,
        driver_account: driverAccount,
        parent_account: parentAccount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in rds-auth-me:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
