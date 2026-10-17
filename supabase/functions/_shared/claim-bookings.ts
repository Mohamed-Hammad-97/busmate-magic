// Links guest daily-line bookings (parent_id IS NULL) to a family once the
// caller has proven they own the phone (SMS code or that number's password).
import { normalizePhone, phoneVariants } from "./parent-family.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** Pure rule: does a stored booking phone belong to one of the family phones? */
export function bookingPhoneMatches(bookingPhone: string, familyPhones: string[]): boolean {
  const b = normalizePhone(bookingPhone);
  if (!b) return false;
  return familyPhones.some((p) => normalizePhone(p) === b);
}

export async function findUnlinkedBookings(supabase: SupabaseClient, phones: string[]) {
  const variants = [...new Set(phones.map(normalizePhone).filter(Boolean).flatMap(phoneVariants))];
  if (variants.length === 0) return [];
  const { data } = await supabase
    .from("daily_line_bookings")
    .select("id, passenger_name, passenger_phone, daily_line_trips(daily_lines(city))")
    .is("parent_id", null)
    .in("passenger_phone", variants);
  return (data ?? []).filter((b: { passenger_phone: string }) => bookingPhoneMatches(b.passenger_phone, phones));
}

export async function claimBookings(supabase: SupabaseClient, parentId: string, phones: string[]) {
  const rows = await findUnlinkedBookings(supabase, phones);
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("daily_line_bookings")
    .update({ parent_id: parentId })
    .in("id", rows.map((r: { id: string }) => r.id))
    .is("parent_id", null);
  if (error) console.error("claimBookings failed:", error);
  return error ? 0 : rows.length;
}
