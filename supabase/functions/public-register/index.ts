import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationData {
  student_name: string;
  parent_name: string;
  national_id?: string;
  father_phone: string;
  mother_phone?: string;
  emergency_phone: string;
  payment_phone: string;
  city: string;
  job?: string;
  comments?: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  school_id: string;
  grade: string;
  car_type: 'ac' | 'non_ac';
  education_department: 'national' | 'ig' | 'american';
  // "Other school" flow (school not listed)
  is_other_school?: boolean;
  other_school_name?: string;
  other_school_address?: string;
  other_school_latitude?: number;
  other_school_longitude?: number;
}

// Validation helpers
// Normalizes: strips spaces/dashes/parens, converts Arabic-Indic digits,
// and maps +20 / 0020 / 20 prefixes to the local 01xxxxxxxxx format.
function normalizePhone(raw?: string): string {
  if (!raw) return "";
  let p = raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\d+]/g, "");
  p = p.replace(/^\+/, "");
  if (p.startsWith("0020")) p = p.slice(4);
  else if (p.startsWith("20") && p.length > 11) p = p.slice(2);
  if (p.startsWith("1") && p.length === 10) p = "0" + p;
  return p;
}

function validatePhone(phone: string): boolean {
  // Egyptian phone format: starts with 01, 11 digits total
  return /^01[0-9]{9}$/.test(phone);
}

function validateNationalId(id: string): boolean {
  // Egyptian national ID: 14 digits
  return /^[0-9]{14}$/.test(id);
}

function sanitizeString(str: string): string {
  // Remove potential SQL injection or XSS characters
  return str.trim().replace(/[<>'"`;]/g, '');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const data: RegistrationData = await req.json();
    // Normalize all phone inputs before validation
    data.father_phone = normalizePhone(data.father_phone);
    data.mother_phone = data.mother_phone ? normalizePhone(data.mother_phone) : data.mother_phone;
    data.emergency_phone = normalizePhone(data.emergency_phone);
    data.payment_phone = normalizePhone(data.payment_phone);
    console.log("Received registration request for:", data.student_name);

    // Validate required fields
    if (!data.student_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "Student name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.parent_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "Parent name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // National ID is optional, but validate format if provided
    if (data.national_id?.trim() && !validateNationalId(data.national_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid national ID format (must be 14 digits)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.father_phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "Father phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validatePhone(data.father_phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid father phone format (must be 01xxxxxxxxx)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.emergency_phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "Emergency phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validatePhone(data.emergency_phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid emergency phone format (must be 01xxxxxxxxx)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (data.mother_phone && !validatePhone(data.mother_phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid mother phone format (must be 01xxxxxxxxx)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.payment_phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "Payment phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validatePhone(data.payment_phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid payment phone format (must be 01xxxxxxxxx)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.city?.trim()) {
      return new Response(
        JSON.stringify({ error: "City is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const isOtherSchool = data.is_other_school === true || data.school_id === 'other';
    if (isOtherSchool) {
      if (!data.other_school_name?.trim()) {
        return new Response(
          JSON.stringify({ error: "School name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!data.school_id?.trim()) {
      return new Response(
        JSON.stringify({ error: "School is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.grade?.trim()) {
      return new Response(
        JSON.stringify({ error: "Grade is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!data.pickup_address?.trim()) {
      return new Response(
        JSON.stringify({ error: "Pickup address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!['ac', 'non_ac'].includes(data.car_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid car type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!['national', 'ig', 'american'].includes(data.education_department)) {
      return new Response(
        JSON.stringify({ error: "Invalid education department" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for secure insertion
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // "Other school" submissions go to a separate review queue
    if (isOtherSchool) {
      const { error: otherError } = await supabase
        .from('other_registrations')
        .insert({
          student_name: sanitizeString(data.student_name),
          parent_name: sanitizeString(data.parent_name),
          national_id: data.national_id?.trim() || null,
          father_phone: data.father_phone,
          mother_phone: data.mother_phone || null,
          emergency_phone: data.emergency_phone,
          payment_phone: data.payment_phone,
          job: data.job ? sanitizeString(data.job) : null,
          city: sanitizeString(data.city),
          comments: data.comments ? sanitizeString(data.comments) : null,
          pickup_latitude: data.pickup_latitude,
          pickup_longitude: data.pickup_longitude,
          pickup_address: sanitizeString(data.pickup_address),
          school_name: sanitizeString(data.other_school_name!),
          school_address: data.other_school_address ? sanitizeString(data.other_school_address) : null,
          school_latitude: data.other_school_latitude ?? null,
          school_longitude: data.other_school_longitude ?? null,
          grade: data.grade,
          car_type: data.car_type,
          education_department: data.education_department,
          status: 'pending',
        });

      if (otherError) {
        console.error("Error creating other registration:", otherError);
        return new Response(
          JSON.stringify({ error: "Failed to submit registration. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Registration submitted successfully", other: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify school exists and is active
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('id', data.school_id)
      .eq('is_active', true)
      .single();

    if (schoolError || !school) {
      console.error("Invalid school:", schoolError);
      return new Response(
        JSON.stringify({ error: "Invalid or inactive school selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if parent already exists by father_phone (same parent can register multiple kids)
    const { data: existingParent } = await supabase
      .from('parent_accounts')
      .select('id')
      .eq('father_phone', data.father_phone)
      .maybeSingle();

    let parentId: string;

    if (existingParent) {
      // Existing parent - add another child registration
      console.log("Existing parent found by phone, adding new registration:", data.father_phone);
      parentId = existingParent.id;
      const { error: reactivateError } = await supabase
        .from('parent_accounts')
        .update({ is_active: true })
        .eq('id', parentId);
      if (reactivateError) throw reactivateError;
    } else {
      // Check for duplicate national ID (only for new parents, and only if national_id provided)
      if (data.national_id?.trim()) {
        const { data: existingByNationalId } = await supabase
          .from('parent_accounts')
          .select('id')
          .eq('national_id', data.national_id)
          .maybeSingle();

        if (existingByNationalId) {
          // Same national ID but different phone - use existing parent
          console.log("National ID already registered:", data.national_id);
          parentId = existingByNationalId.id;
        }
      }

      if (!parentId) {
        // Check phone uniqueness across employees, drivers, supervisors
        const { data: empPhone } = await supabase
          .from('employees')
          .select('id')
          .eq('phone', data.father_phone)
          .maybeSingle();
        
        const { data: driverPhone } = await supabase
          .from('drivers')
          .select('id')
          .eq('phone', data.father_phone)
          .maybeSingle();
        
        const { data: supervisorPhone } = await supabase
          .from('supervisors')
          .select('id')
          .eq('phone', data.father_phone)
          .maybeSingle();

        if (empPhone || driverPhone || supervisorPhone) {
          return new Response(
            JSON.stringify({ error: "This phone number is already registered with another role (employee/driver/supervisor). Each phone number can only be used for one role." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create new parent account
        const { data: newParent, error: parentError } = await supabase
          .from('parent_accounts')
          .insert({
            parent_name: sanitizeString(data.parent_name),
            national_id: data.national_id?.trim() || '0',
            father_phone: data.father_phone,
            mother_phone: data.mother_phone || null,
            emergency_phone: data.emergency_phone,
            payment_phone: data.payment_phone,
            city: sanitizeString(data.city),
            job: data.job ? sanitizeString(data.job) : null,
            pickup_latitude: data.pickup_latitude,
            pickup_longitude: data.pickup_longitude,
            pickup_address: sanitizeString(data.pickup_address),
          })
          .select()
          .single();

        if (parentError) {
          console.error("Error creating parent account:", parentError);
          return new Response(
            JSON.stringify({ error: "Failed to create parent account. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Created parent account:", newParent.id);
        parentId = newParent.id;
      }
    }

    // Create registration
    const { error: regError } = await supabase
      .from('registrations')
      .insert({
        parent_id: parentId,
        student_name: sanitizeString(data.student_name),
        school_id: data.school_id,
        grade: data.grade,
        car_type: data.car_type,
        education_department: data.education_department,
        comments: data.comments ? sanitizeString(data.comments) : null,
        status: 'pending_fees',
      });

    if (regError) {
      console.error("Error creating registration:", regError);
      return new Response(
        JSON.stringify({ error: "Failed to create registration. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Registration completed successfully for:", data.student_name);

    return new Response(
      JSON.stringify({ success: true, message: "Registration submitted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
