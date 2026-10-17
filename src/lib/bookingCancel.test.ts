// @ts-ignore bun test runner types
import { describe, it, expect } from "bun:test";
import { getCancelState, departureUtcMs } from "./bookingCancel";

const b = (cutoff: number, extra: any = {}) => ({
  payment_status: "pending",
  daily_line_trips: { status: "scheduled", trip_date: "2026-10-20", departure_time: "17:00:00", cancel_cutoff_hours: cutoff },
  ...extra,
});
const dep = departureUtcMs("2026-10-20", "17:00");
const min = 60000;

describe("cancel cutoff", () => {
  it("2h cutoff: allowed at 14:59 Cairo", () => expect(getCancelState(b(2), dep - 121 * min)).toBe("allowed"));
  it("2h cutoff: closed at 15:01 Cairo", () => expect(getCancelState(b(2), dep - 119 * min)).toBe("closed"));
  it("1h cutoff: allowed at 15:30 Cairo", () => expect(getCancelState(b(1), dep - 90 * min)).toBe("allowed"));
  it("no-cancel option is always closed", () => expect(getCancelState(b(0), dep - 48 * 60 * min)).toBe("closed"));
  it("paid booking cannot be cancelled by customer", () => expect(getCancelState(b(2, { payment_status: "paid" }), dep - 48 * 60 * min)).toBe("paid"));
});
