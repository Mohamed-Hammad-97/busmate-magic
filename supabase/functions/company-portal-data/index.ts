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
    // Handle public actions first (no auth needed)
    const body = await req.json();
    const { action, data } = body;

    if (action === "get-public-company-info") {
      const companyId = data?.company_id;
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "Missing company_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: company } = await supabase
        .from("companies")
        .select("id, name, city, is_active")
        .eq("id", companyId)
        .eq("is_active", true)
        .single();

      if (!company) {
        return new Response(
          JSON.stringify({ error: "Company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: lines } = await supabase
        .from("company_lines")
        .select("id, name, route_details")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      return new Response(
        JSON.stringify({ company, lines: lines || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // action and data already parsed from body above
    const supabase = createClient(
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

      case "get-employees": {
        const { data: employees, error } = await supabase
          .from("company_employees")
          .select("*, company_lines(name)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ employees }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-live-trips": {
        // Get driver IDs from company lines
        const { data: companyLines } = await supabase
          .from("company_lines")
          .select("driver_id, supervisor_id, name")
          .eq("company_id", companyId)
          .eq("is_active", true);

        const driverIds = (companyLines || []).map((l: any) => l.driver_id).filter(Boolean);
        const supervisorIds = (companyLines || []).map((l: any) => l.supervisor_id).filter(Boolean);

        if (driverIds.length === 0 && supervisorIds.length === 0) {
          return new Response(JSON.stringify({ trips: [], lines: companyLines || [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find active trips for these drivers
        let query = supabase
          .from("live_trips")
          .select("id, status, current_latitude, current_longitude, started_at, driver_id, supervisor_id, drivers(full_name, phone), supervisors(full_name, phone)")
          .eq("status", "in_progress");

        if (driverIds.length > 0) {
          query = query.in("driver_id", driverIds);
        }

        const { data: trips, error } = await query;
        if (error) throw error;

        // Map trip to line name
        const tripsWithLine = (trips || []).map((trip: any) => {
          const line = (companyLines || []).find((l: any) => l.driver_id === trip.driver_id);
          return { ...trip, line_name: line?.name || "غير محدد" };
        });

        return new Response(JSON.stringify({ trips: tripsWithLine, lines: companyLines || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-public-company-info": {
        // This action doesn't need auth - handled separately below
        return new Response(
          JSON.stringify({ error: "Use public endpoint" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
