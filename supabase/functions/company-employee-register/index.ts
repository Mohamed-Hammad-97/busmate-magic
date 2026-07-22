import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, company_line_id, full_name, phone, national_id, department, pickup_address, pickup_latitude, pickup_longitude, notes } = await req.json();

    if (!company_id || !full_name || !phone) {
      return new Response(
        JSON.stringify({ error: "الاسم ورقم الهاتف مطلوبان" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify company exists and is active
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, is_active")
      .eq("id", company_id)
      .single();

    if (companyError || !company || !company.is_active) {
      return new Response(
        JSON.stringify({ error: "الشركة غير موجودة أو غير نشطة" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate phone in same company
    const { data: existing } = await supabase
      .from("company_employees")
      .select("id")
      .eq("company_id", company_id)
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف مسجل بالفعل في هذه الشركة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify line belongs to company if provided
    if (company_line_id) {
      const { data: line } = await supabase
        .from("company_lines")
        .select("id")
        .eq("id", company_line_id)
        .eq("company_id", company_id)
        .maybeSingle();

      if (!line) {
        return new Response(
          JSON.stringify({ error: "الخط غير موجود" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: employee, error: insertError } = await supabase
      .from("company_employees")
      .insert({
        company_id,
        company_line_id: company_line_id || null,
        full_name: full_name.trim(),
        phone: phone.trim(),
        national_id: national_id?.trim() || null,
        department: department?.trim() || null,
        pickup_address: pickup_address?.trim() || null,
        pickup_latitude: pickup_latitude || null,
        pickup_longitude: pickup_longitude || null,
        notes: notes?.trim() || null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, id: employee.id, company_name: company.name }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in company-employee-register:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
