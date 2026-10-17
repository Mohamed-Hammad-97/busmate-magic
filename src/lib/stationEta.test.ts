import { describe, it, expect } from "bun:test";
import { etaFor } from "./stationEta";
describe("etaFor", () => {
  it("adds minutes to departure", () => expect(etaFor("17:00:00", 12)).toBe("17:12"));
  it("wraps past midnight", () => expect(etaFor("23:50", 20)).toBe("00:10"));
  it("null without minutes", () => expect(etaFor("17:00", null)).toBeNull());
});
