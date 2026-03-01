import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyCompanyToken(token: string): Promise<any> {
  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) throw new Error("JWT_SECRET not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  // Verify signature
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBytes = Uint8Array.from(
    atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(atob(parts[1]));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const claims = await verifyCompanyToken(token);
    const companyId = claims.company_id;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Invalid token: no company_id" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, data } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "get-lines": {
        const { data: lines, error } = await supabase
          .from("company_lines")
          .select("*, drivers(full_name, phone), supervisors(full_name, phone)")
          .eq("company_id", companyId)
          .order("name");
        if (error) throw error;
        return new Response(JSON.stringify({ lines }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-invoices": {
        const { data: invoices, error } = await supabase
          .from("company_invoices")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ invoices }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-invoice-approval": {
        const { invoice_id, status, comment } = data || {};
        if (!invoice_id || !status) {
          return new Response(
            JSON.stringify({ error: "Missing invoice_id or status" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify invoice belongs to this company
        const { data: invoice } = await supabase
          .from("company_invoices")
          .select("company_id")
          .eq("id", invoice_id)
          .single();

        if (!invoice || invoice.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Invoice not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("company_invoices")
          .update({
            company_approval_status: status,
            company_comment: comment || null,
            company_approved_by: claims.sub,
            company_approved_at: new Date().toISOString(),
          })
          .eq("id", invoice_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Error in company-portal-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage.includes("Unauthorized") || errorMessage.includes("expired") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
