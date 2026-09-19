# Fix: "إنهاء الرحلة" sends the supervisor to login and the trip stays open

## What is happening

The supervisor on 01201535953 (route #55) has a trip that started today at 15:17 Cairo and is still marked in progress in the database, so the end action never actually completed.

Ending a trip is currently done straight from the phone with the supervisor's own login, and unlike starting a trip it does not refresh the login first and does not check afterwards that the trip was really closed. So when the phone's login has gone stale:

- the request is rejected and the app bounces to the login screen;
- after signing in again, the same button can report success while the trip stays open, because a rejected update returns no error — it simply changes nothing.

## The fix

1. Close the trip on the server instead of from the phone, the same way starting a trip already works: the server checks the supervisor is responsible for that line (including cover duty), marks remaining students as delivered, completes the trip, and sends the parent notifications.
2. Before ending, renew the login silently; if it is rejected once, renew and retry once more. Never force the supervisor back to the login screen — show a short Arabic message only if it truly fails.
3. Confirm the trip really shows as finished before showing "تم إنهاء الرحلة"; otherwise show a clear Arabic error so nobody thinks it ended when it did not.
4. Close the stuck route #55 trip (and check the other lines still open from this morning) so the supervisor starts clean.

## Technical details

- New edge function `supabase/functions/end-live-trip/index.ts`, mirroring `start-live-trip`: `verify_jwt = false` in `supabase/config.toml`, bearer token read and validated via `getClaims()`, service-role client, authorization via `can_start_route_trip(user_id, route_id)`, returns `{ code: "NOT_ASSIGNED" | "SESSION_EXPIRED" }` on failure. Inside: bulk-update `trip_student_status` to `dropped_off`, set `live_trips.status = 'completed'` + `completed_at`, insert `trip_completed` rows in `trip_notifications`, idempotent when the trip is already completed.
- `src/hooks/useLiveTrip.ts`: rewrite `endTripMutation` to `ensureFreshDriverSession()` then `supabase.functions.invoke("end-live-trip", { body: { tripId } })`, reusing the `attempt()` + single silent `refreshSession` retry pattern from `startTripMutation`; `SESSION_EXPIRED_FINAL` shows a toast only, no sign-out or redirect. Success invalidates `["live-trip"]` and `["trip-students"]`.
- Data cleanup for the open `live_trips` rows from this morning is applied as a one-off update after the code fix.
