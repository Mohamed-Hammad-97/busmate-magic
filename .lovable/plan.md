# Link guest daily-line bookings to the customer's account

## Goal

A customer who books a daily-line trip without an account (or before signing in) must see that booking under "Upcoming trips" as soon as they sign in or create their account with the same phone number, from the "View trips" button or any other route into the customer portal.

## How it will work

1. **Right after booking:** the "View trips" button sends the customer to the customer portal sign-in with their booking phone already filled in.
2. **New customer (no account yet):** they verify the phone by SMS code and their account is created. Every earlier booking made with that phone and not yet linked to anyone is attached to the new account automatically.
3. **Existing customer:** on every sign-in (password or SMS code), any unlinked bookings with the father's or mother's number are attached to the family account.
4. **Safety:** bookings are linked only after the phone has been proven (SMS code or that number's own password), never just from a number typed into a form. Bookings already linked to another account are never moved.
5. **Today's bookings:** the two bookings already made today with 01151607830 (Ahmed and Mohamed) are linked to Ahmed's account so they show immediately.

## Technical details

- New edge function `claim-daily-line-bookings`: validates the caller's bearer token, resolves the family's parent records and phones (`_shared/parent-family.ts`), normalizes phones with `normalize_eg_phone`, then `UPDATE daily_line_bookings SET parent_id = <caller's primary parent id> WHERE parent_id IS NULL AND normalize_eg_phone(passenger_phone) IN (family phones)`. Service role, no client-supplied owner.
- Call it from `ParentAuthContext` after `verifyOtp` and `loginWithPassword` succeed, and once on session restore (fire-and-forget, then invalidate the bookings query in `DailyLinePortal.tsx`).
- New-account path: confirm `verify-otp` / account creation for a phone with no parent record creates the account; then the same claim runs, so the new account gets the bookings.
- `RegisterDailyLine.tsx`: "View trips" navigates to `/parent/auth?phone=<booking phone>&next=/daily-lines-portal`; `ParentAuth.tsx` pre-fills the phone and redirects to `next` after sign-in.
- One-time data fix (data query, not migration) linking today's two bookings to parent `88bd5f52-...`.
- Test: a small test for the phone-match rule (normalized 01xxxxxxxxx vs +20 formats match; already-linked bookings untouched).
- Verify: book as guest with a new number, sign up via SMS code, confirm the trip appears under Upcoming trips; sign in as Ahmed and confirm both bookings appear.
