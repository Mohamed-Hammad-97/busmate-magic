import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateBoardingCode(existing: Set<string>): string {
  // 2-digit code, unique within the trip; if all 100 are taken (impossible for 100-seat bus), fallback
  for (let i = 0; i < 200; i++) {
    const n = Math.floor(Math.random() * 100);
    const code = n.toString().padStart(2, "0");
    if (!existing.has(code)) return code;
  }
  // Fallback: scan sequentially
  for (let n = 0; n < 100; n++) {
    const code = n.toString().padStart(2, "0");
    if (!existing.has(code)) return code;
  }
  throw new Error("No boarding codes available");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      trip_id,
      passenger_name,
      passenger_phone,
      pickup_station_id,
      dropoff_station_id,
      payment_method,
      promocode,
      proof_file_base64,
      proof_file_ext,
      proof_file_type,
    } = body ?? {};

    if (!trip_id || !passenger_name || !passenger_phone || !payment_method) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["cash", "instapay"].includes(payment_method)) {
      return new Response(JSON.stringify({ error: "Invalid payment method" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional receipt upload
    let payment_proof_url: string | null = null;
    if (proof_file_base64) {
      const allowedExt = ["jpg", "jpeg", "png", "webp", "pdf"];
      const ext = String(proof_file_ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      if (!allowedExt.includes(ext)) {
        return new Response(JSON.stringify({ error: "Invalid receipt file type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Decode base64 and enforce size (max 5MB)
      let bytes: Uint8Array;
      try {
        const bin = atob(proof_file_base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid receipt encoding" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (bytes.byteLength > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Receipt too large (max 5MB)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payment_proof_url = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      // We'll upload after admin client is created below
      (globalThis as unknown as { __pendingReceipt: { path: string; bytes: Uint8Array; type: string } }).__pendingReceipt = {
        path: payment_proof_url,
        bytes,
        type: proof_file_type || "application/octet-stream",
      };
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upload receipt server-side using service role (anonymous direct uploads are blocked)
    const pendingReceipt = (globalThis as unknown as { __pendingReceipt?: { path: string; bytes: Uint8Array; type: string } }).__pendingReceipt;
    if (pendingReceipt) {
      const { error: upErr } = await admin.storage
        .from("daily-line-receipts")
        .upload(pendingReceipt.path, pendingReceipt.bytes, {
          contentType: pendingReceipt.type,
          upsert: false,
        });
      delete (globalThis as unknown as { __pendingReceipt?: unknown }).__pendingReceipt;
      if (upErr) {
        return new Response(JSON.stringify({ error: `Receipt upload failed: ${upErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load trip
    const { data: trip, error: tripErr } = await admin
      .from("daily_line_trips")
      .select("id, available_seats, cash_price, instapay_price, status")
      .eq("id", trip_id)
      .maybeSingle();
    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (trip.status !== "scheduled") {
      return new Response(JSON.stringify({ error: "Trip is not bookable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (trip.available_seats <= 0) {
      return new Response(JSON.stringify({ error: "No seats available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pricing
    const original = Number(payment_method === "cash" ? trip.cash_price : trip.instapay_price);
    let discount = 0;
    let promoId: string | null = null;
    if (promocode) {
      const { data: promo } = await admin
        .from("daily_line_promocodes")
        .select("id, promo_type, value, max_uses, used_count, expires_at, is_active")
        .ilike("code", promocode.trim())
        .maybeSingle();
      if (promo && promo.is_active &&
          (!promo.expires_at || promo.expires_at >= new Date().toISOString().slice(0, 10)) &&
          (promo.max_uses == null || promo.used_count < promo.max_uses)) {
        promoId = promo.id;
        discount = promo.promo_type === "percentage"
          ? Math.round(((original * Number(promo.value)) / 100) * 100) / 100
          : Number(promo.value);
        if (discount > original) discount = original;
      }
    }
    const final = Math.max(0, original - discount);

    // Try to look up parent by phone (so logged-in customer portal will see this booking)
    const { data: parent } = await admin
      .from("parent_accounts")
      .select("id")
      .eq("father_phone", passenger_phone)
      .maybeSingle();

    // Existing boarding codes for this trip
    const { data: existing } = await admin
      .from("daily_line_bookings")
      .select("boarding_code")
      .eq("trip_id", trip_id);
    const taken = new Set((existing ?? []).map((b: { boarding_code: string }) => b.boarding_code));
    const boarding_code = generateBoardingCode(taken);

    const { data: inserted, error: insErr } = await admin
      .from("daily_line_bookings")
      .insert({
        trip_id,
        parent_id: parent?.id ?? null,
        passenger_name: String(passenger_name).trim().slice(0, 120),
        passenger_phone: String(passenger_phone).trim().slice(0, 20),
        pickup_station_id: pickup_station_id || null,
        dropoff_station_id: dropoff_station_id || null,
        payment_method,
        promocode_id: promoId,
        original_price: original,
        discount_amount: discount,
        final_price: final,
        payment_proof_url: payment_proof_url || null,
        boarding_code,
      })
      .select("id, boarding_code, final_price")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (promoId) {
      // Increment manually: fetch + +1
      const { data: p } = await admin
        .from("daily_line_promocodes")
        .select("used_count")
        .eq("id", promoId)
        .single();
      if (p) {
        await admin
          .from("daily_line_promocodes")
          .update({ used_count: (p.used_count ?? 0) + 1 })
          .eq("id", promoId);
      }
    }

    return new Response(JSON.stringify({ booking: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
