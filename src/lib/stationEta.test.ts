// @ts-ignore bun test runner types
import { describe, it, expect } from "bun:test";
import { etaFor } from "./stationEta";
describe("etaFor", () => {
  it("adds minutes to departure", () => expect(etaFor("17:00:00", 12)).toBe("17:12"));
  it("wraps past midnight", () => expect(etaFor("23:50", 20)).toBe("00:10"));
  it("null without minutes", () => expect(etaFor("17:00", null)).toBeNull());
});

import { stationMinutesMap } from "./stationEta";
describe("stationMinutesMap", () => {
  it("prefers stored minutes", () => {
    expect(stationMinutesMap([{ id: "a", station_order: 0, latitude: 0, longitude: 0, minutes_from_start: 0 }, { id: "b", station_order: 1, latitude: 0, longitude: 1, minutes_from_start: 12 }]).b).toBe(12);
  });
  it("estimates when missing", () => {
    const m = stationMinutesMap([{ id: "a", station_order: 0, latitude: 31.28, longitude: 30.01 }, { id: "b", station_order: 1, latitude: 31.27, longitude: 30.0 }]);
    expect(m.a).toBe(0);
    expect(m.b).toBeGreaterThan(0);
  });
});

import { isStationUpcoming as up } from "./stationEta";
describe("station ETA cutoff", () => {
  // 2026-10-17 15:40 UTC = 18:40 Cairo (UTC+3)
  const now = new Date("2026-10-17T15:40:00Z");
  it("passed station at 18:30+0 is not bookable", () => expect(up("2026-10-17", "18:30", 0, now)).toBe(false));
  it("station at 18:30+25 (18:55) is still bookable", () => expect(up("2026-10-17", "18:30", 25, now)).toBe(true));
  it("tomorrow's trip is bookable", () => expect(up("2026-10-18", "06:00", 0, now)).toBe(true));
});
