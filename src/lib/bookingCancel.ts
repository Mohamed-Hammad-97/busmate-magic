export type CancelState = "allowed" | "paid" | "closed" | "none";

/** Cairo is UTC+3 (no DST in this app's scope). */
const CAIRO_OFFSET_MIN = 180;

export function departureUtcMs(tripDate: string, departureTime: string): number {
  const [y, m, d] = tripDate.split("-").map(Number);
  const [hh, mm] = departureTime.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - CAIRO_OFFSET_MIN * 60000;
}

export function getCancelState(b: any, nowMs = Date.now()): CancelState {
  const t = b?.daily_line_trips;
  if (!t || b.payment_status === "cancelled" || t.status === "cancelled" || t.status === "completed") return "none";
  if (b.boarded_at || b.dropped_at) return "none";
  if (b.payment_status !== "pending") return "paid";
  const cutoff = Number(t.cancel_cutoff_hours ?? 2);
  if (t.status !== "scheduled" || cutoff === 0 || !t.trip_date || !t.departure_time) return "closed";
  return nowMs < departureUtcMs(t.trip_date, t.departure_time) - cutoff * 3600000 ? "allowed" : "closed";
}

export function cancelErrorMessage(msg: string, isRtl: boolean): string {
  if (msg.includes("paid_contact_support")) return isRtl ? "الحجوزات المدفوعة: تواصل مع الدعم للإلغاء" : "Paid bookings: contact support to cancel";
  if (msg.includes("window_closed")) return isRtl ? "انتهت مهلة الإلغاء" : "Cancellation window closed";
  return msg;
}
