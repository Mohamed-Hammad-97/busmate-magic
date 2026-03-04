import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { hashPassword } from "../_shared/password-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyCompanyToken(token: string): Promise<any> {
  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) throw new Error("JWT_SECRET not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

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
    const body = await req.json();
    const { action, data } = body;

    // === PUBLIC ACTIONS (no auth) ===
    if (action === "get-public-company-info") {
      const companyId = data?.company_id;
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "Missing company_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: company } = await supabase
        .from("companies")
        .select("id, name, city, is_active, logo_url")
        .eq("id", companyId)
        .eq("is_active", true)
        .single();

      if (!company) {
        return new Response(JSON.stringify({ error: "Company not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: lines } = await supabase
        .from("company_lines")
        .select("id, name, route_details")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      return new Response(JSON.stringify({ company, lines: lines || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Forgot password - public action
    if (action === "forgot-password-request") {
      const { email: reqEmail } = data || {};
      if (!reqEmail) {
        return new Response(JSON.stringify({ error: "Missing email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sbPublic = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: companyAccount } = await sbPublic
        .from("company_accounts")
        .select("id, email, full_name, company_id, companies(name)")
        .eq("email", reqEmail.toLowerCase())
        .maybeSingle();

      if (companyAccount) {
        await sbPublic.from("company_notifications").insert({
          company_id: companyAccount.company_id,
          notification_type: "password_reset_request",
          title: "Password Reset Request",
          message: `${companyAccount.full_name} (${companyAccount.email}) from ${(companyAccount as any).companies?.name || 'Unknown'} has requested a password reset.`,
          metadata: { account_id: companyAccount.id, email: companyAccount.email },
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === AUTHENTICATED ACTIONS ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const claims = await verifyCompanyToken(token);
    const companyId = claims.company_id;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "Invalid token: no company_id" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    switch (action) {
      case "get-lines": {
        const { data: lines, error } = await supabase
          .from("company_lines")
          .select("*, drivers(full_name, phone), supervisors(full_name, phone)")
          .eq("company_id", companyId)
          .order("name");
        if (error) throw error;
        return new Response(JSON.stringify({ lines }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-invoices": {
        const { data: invoices, error } = await supabase
          .from("company_invoices")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ invoices }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update-invoice-approval": {
        const { invoice_id, status, comment } = data || {};
        if (!invoice_id || !status) {
          return new Response(JSON.stringify({ error: "Missing invoice_id or status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: invoice } = await supabase
          .from("company_invoices")
          .select("company_id")
          .eq("id", invoice_id)
          .single();

        if (!invoice || invoice.company_id !== companyId) {
          return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-employees": {
        const { data: employees, error } = await supabase
          .from("company_employees")
          .select("*, company_lines(name)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ employees }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-live-trips": {
        const { data: companyLines } = await supabase
          .from("company_lines")
          .select("driver_id, supervisor_id, name")
          .eq("company_id", companyId)
          .eq("is_active", true);

        const driverIds = (companyLines || []).map((l: any) => l.driver_id).filter(Boolean);

        if (driverIds.length === 0) {
          return new Response(JSON.stringify({ trips: [], lines: companyLines || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: trips, error } = await supabase
          .from("live_trips")
          .select("id, status, current_latitude, current_longitude, started_at, driver_id, supervisor_id, drivers(full_name, phone), supervisors(full_name, phone)")
          .eq("status", "in_progress")
          .in("driver_id", driverIds);

        if (error) throw error;

        const tripsWithLine = (trips || []).map((trip: any) => {
          const line = (companyLines || []).find((l: any) => l.driver_id === trip.driver_id);
          return { ...trip, line_name: line?.name || "غير محدد" };
        });

        return new Response(JSON.stringify({ trips: tripsWithLine, lines: companyLines || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === DRIVER DETAILS (no salary) ===
      case "get-drivers": {
        const { data: companyLines } = await supabase
          .from("company_lines")
          .select("driver_id, supervisor_id, name")
          .eq("company_id", companyId);

        const driverIds = [...new Set((companyLines || []).map((l: any) => l.driver_id).filter(Boolean))];
        const supervisorIds = [...new Set((companyLines || []).map((l: any) => l.supervisor_id).filter(Boolean))];

        let drivers: any[] = [];
        let supervisors: any[] = [];

        if (driverIds.length > 0) {
          const { data } = await supabase
            .from("drivers")
            .select("id, full_name, phone, license_number, documents_url, is_active, city")
            .in("id", driverIds);
          drivers = data || [];
        }

        if (supervisorIds.length > 0) {
          const { data } = await supabase
            .from("supervisors")
            .select("id, full_name, phone, documents_url, is_active, city")
            .in("id", supervisorIds);
          supervisors = data || [];
        }

        // Map line assignments
        const driversWithLines = drivers.map((d: any) => ({
          ...d,
          type: "driver",
          assigned_lines: (companyLines || []).filter((l: any) => l.driver_id === d.id).map((l: any) => l.name),
        }));

        const supervisorsWithLines = supervisors.map((s: any) => ({
          ...s,
          type: "supervisor",
          assigned_lines: (companyLines || []).filter((l: any) => l.supervisor_id === s.id).map((l: any) => l.name),
        }));

        return new Response(JSON.stringify({ staff: [...driversWithLines, ...supervisorsWithLines] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === STAFF PROFILES (read-only for company portal) ===
      case "get-staff-profiles": {
        const { data: companyLines } = await supabase
          .from("company_lines")
          .select("driver_id, supervisor_id, name")
          .eq("company_id", companyId);

        const driverIds = [...new Set((companyLines || []).map((l: any) => l.driver_id).filter(Boolean))];
        const supervisorIds = [...new Set((companyLines || []).map((l: any) => l.supervisor_id).filter(Boolean))];

        let drivers: any[] = [];
        let supervisors: any[] = [];
        let staffProfiles: any[] = [];

        if (driverIds.length > 0) {
          const { data } = await supabase
            .from("drivers")
            .select("id, full_name, phone, license_number, is_active")
            .in("id", driverIds);
          drivers = data || [];

          const { data: profiles } = await supabase
            .from("staff_profiles")
            .select("driver_id, bank_name, bank_account_name, bank_account_number, bank_iban, id_document_url, license_document_url, contract_document_url")
            .in("driver_id", driverIds);
          staffProfiles.push(...(profiles || []));
        }

        if (supervisorIds.length > 0) {
          const { data } = await supabase
            .from("supervisors")
            .select("id, full_name, phone, is_active")
            .in("id", supervisorIds);
          supervisors = data || [];

          const { data: profiles } = await supabase
            .from("staff_profiles")
            .select("supervisor_id, bank_name, bank_account_name, bank_account_number, bank_iban, id_document_url, license_document_url, contract_document_url")
            .in("supervisor_id", supervisorIds);
          staffProfiles.push(...(profiles || []));
        }

        const driversWithProfiles = drivers.map((d: any) => {
          const profile = staffProfiles.find((p: any) => p.driver_id === d.id);
          const assignedLines = (companyLines || []).filter((l: any) => l.driver_id === d.id).map((l: any) => l.name);
          return { ...d, type: "driver", profile: profile || null, assigned_lines: assignedLines };
        });

        const supervisorsWithProfiles = supervisors.map((s: any) => {
          const profile = staffProfiles.find((p: any) => p.supervisor_id === s.id);
          const assignedLines = (companyLines || []).filter((l: any) => l.supervisor_id === s.id).map((l: any) => l.name);
          return { ...s, type: "supervisor", profile: profile || null, assigned_lines: assignedLines };
        });

        return new Response(JSON.stringify({ staff: [...driversWithProfiles, ...supervisorsWithProfiles] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === INTERNAL ACCOUNTS MANAGEMENT ===
      case "get-accounts": {
        if (claims.role !== "admin") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: accounts, error } = await supabase
          .from("company_accounts")
          .select("id, email, full_name, phone, role, permissions, is_active, created_at")
          .eq("company_id", companyId)
          .order("created_at");
        if (error) throw error;
        return new Response(JSON.stringify({ accounts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create-account": {
        if (claims.role !== "admin") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { email, password, full_name, phone, role, permissions } = data || {};
        if (!email || !password || !full_name) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: existing } = await supabase
          .from("company_accounts")
          .select("id")
          .eq("email", email.toLowerCase())
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const passwordHash = await hashPassword(password);
        const { error } = await supabase
          .from("company_accounts")
          .insert({
            company_id: companyId,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            full_name,
            phone: phone || null,
            role: role || "employee",
            permissions: permissions || [],
          });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "toggle-account": {
        if (claims.role !== "admin") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { account_id, is_active } = data || {};
        if (!account_id) {
          return new Response(JSON.stringify({ error: "Missing account_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Can't deactivate yourself
        if (account_id === claims.sub) {
          return new Response(JSON.stringify({ error: "Cannot modify your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { error } = await supabase
          .from("company_accounts")
          .update({ is_active })
          .eq("id", account_id)
          .eq("company_id", companyId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === NOTIFICATIONS ===
      case "get-notifications": {
        const { data: notifications, error } = await supabase
          .from("company_notifications")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return new Response(JSON.stringify({ notifications }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "mark-notifications-read": {
        const { error } = await supabase
          .from("company_notifications")
          .update({ is_read: true })
          .eq("company_id", companyId)
          .eq("is_read", false);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === CHAT ===
      case "get-chat-channels": {
        // Get driver channels from company lines
        const { data: companyLines } = await supabase
          .from("company_lines")
          .select("driver_id, name, drivers(full_name, phone)")
          .eq("company_id", companyId)
          .not("driver_id", "is", null);

        const channels: any[] = [];

        // Driver channels
        for (const line of (companyLines || [])) {
          if (line.driver_id) {
            const { count } = await supabase
              .from("company_portal_messages")
              .select("*", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("channel_type", "driver_chat")
              .eq("channel_ref_id", line.driver_id)
              .eq("is_read", false)
              .neq("sender_type", "company_account");

            channels.push({
              id: `driver_${line.driver_id}`,
              type: "driver_chat",
              ref_id: line.driver_id,
              name: `${line.drivers?.full_name || "سائق"} - ${line.name}`,
              phone: line.drivers?.phone,
              unread: count || 0,
            });
          }
        }

        // Seater support channel
        const { count: seaterUnread } = await supabase
          .from("company_portal_messages")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("channel_type", "seater_support")
          .eq("is_read", false)
          .neq("sender_type", "company_account");

        channels.push({
          id: "seater_support",
          type: "seater_support",
          ref_id: null,
          name: "دعم Seater",
          unread: seaterUnread || 0,
        });

        return new Response(JSON.stringify({ channels }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-chat-messages": {
        const { channel_type, channel_ref_id } = data || {};
        if (!channel_type) {
          return new Response(JSON.stringify({ error: "Missing channel_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let query = supabase
          .from("company_portal_messages")
          .select("*")
          .eq("company_id", companyId)
          .eq("channel_type", channel_type)
          .order("created_at", { ascending: true })
          .limit(100);

        if (channel_ref_id) {
          query = query.eq("channel_ref_id", channel_ref_id);
        }

        const { data: messages, error } = await query;
        if (error) throw error;

        // Mark as read
        await supabase
          .from("company_portal_messages")
          .update({ is_read: true })
          .eq("company_id", companyId)
          .eq("channel_type", channel_type)
          .eq("is_read", false)
          .neq("sender_type", "company_account");

        return new Response(JSON.stringify({ messages }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "send-chat-message": {
        const { channel_type, channel_ref_id, message } = data || {};
        if (!channel_type || !message?.trim()) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { error } = await supabase
          .from("company_portal_messages")
          .insert({
            company_id: companyId,
            channel_type,
            channel_ref_id: channel_ref_id || null,
            sender_type: "company_account",
            sender_id: claims.sub,
            sender_name: claims.full_name || "مسؤول الشركة",
            message: message.trim(),
          });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "change-password": {
        const { current_password, new_password } = data || {};
        if (!current_password || !new_password) {
          return new Response(JSON.stringify({ error: "Missing current or new password" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (new_password.length < 6) {
          return new Response(JSON.stringify({ error: "New password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Import verifyPassword
        const { verifyPassword } = await import("../_shared/password-utils.ts");

        const { data: account, error: accErr } = await supabase
          .from("company_accounts")
          .select("id, password_hash")
          .eq("id", claims.sub)
          .single();
        if (accErr || !account) {
          return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const isValid = await verifyPassword(current_password, account.password_hash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Current password is incorrect" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const newHash = await hashPassword(new_password);
        const { error: updateErr } = await supabase
          .from("company_accounts")
          .update({ password_hash: newHash, updated_at: new Date().toISOString() })
          .eq("id", claims.sub);
        if (updateErr) throw updateErr;

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });



      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error: unknown) {
    console.error("Error in company-portal-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage.includes("Unauthorized") || errorMessage.includes("expired") ? 401 : 500;
    return new Response(JSON.stringify({ error: errorMessage }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
