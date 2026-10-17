import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bookingPhoneMatches } from "./claim-bookings.ts";

Deno.test("booking phone matches across 01 / +20 / 20 formats", () => {
  assertEquals(bookingPhoneMatches("01151607830", ["1151607830"]), true);
  assertEquals(bookingPhoneMatches("+201151607830", ["01151607830"]), true);
  assertEquals(bookingPhoneMatches("201151607830", ["01151607830"]), true);
});

Deno.test("a different phone never matches", () => {
  assertEquals(bookingPhoneMatches("01151607831", ["01151607830"]), false);
  assertEquals(bookingPhoneMatches("", ["01151607830"]), false);
});
