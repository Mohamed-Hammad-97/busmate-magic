import { describe, it, expect } from "vitest";
import { getBookingOutcome } from "./bookingOutcome";

describe("getBookingOutcome", () => {
  it("finished trip never boarded is missed", () => {
    expect(getBookingOutcome({ payment_status: "pending", daily_line_trips: { status: "completed" } })).toBe("missed");
  });
  it("boarded passenger on finished trip is completed", () => {
    expect(getBookingOutcome({ payment_status: "paid", boarded_at: "2026-10-17T10:00:00Z", daily_line_trips: { status: "completed" } })).toBe("completed");
  });
  it("cancelled trip is cancelled", () => {
    expect(getBookingOutcome({ payment_status: "pending", daily_line_trips: { status: "cancelled" } })).toBe("cancelled");
  });
  it("scheduled trip is upcoming", () => {
    expect(getBookingOutcome({ payment_status: "pending", daily_line_trips: { status: "scheduled" } })).toBe("upcoming");
  });
});
