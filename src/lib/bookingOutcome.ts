export type BookingOutcome = "completed" | "missed" | "cancelled" | "upcoming";

export function getBookingOutcome(b: {
  payment_status?: string | null;
  boarded_at?: string | null;
  dropped_at?: string | null;
  daily_line_trips?: { status?: string | null } | null;
}): BookingOutcome {
  const tripStatus = b.daily_line_trips?.status;
  if (b.payment_status === "cancelled" || tripStatus === "cancelled") return "cancelled";
  if (b.boarded_at || b.dropped_at) return "completed";
  if (tripStatus === "completed") return "missed";
  return "upcoming";
}
