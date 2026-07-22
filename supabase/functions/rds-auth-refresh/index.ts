import { getRdsClient } from "../_shared/rds-client.ts";
import { verifyToken, generateTokens } from "../_shared/jwt-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefreshRequest {
  refresh_token: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { refresh_token }: RefreshRequest = await req.json();

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: "Refresh token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the refresh token
    const payload = await verifyToken(refresh_token);
    
    if (!payload || payload.type !== "refresh") {
      return new Response(
        JSON.stringify({ error: "Invalid or expired refresh token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = getRdsClient();

    // Get user data
    const userResult = await sql`
      SELECT id, email, phone, full_name
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

    // Generate new tokens
    const tokens = await generateTokens(user.id, user.email, user.phone, role);

    console.log("Tokens refreshed for user:", user.id);

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
        ...tokens,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in rds-auth-refresh:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
