# Fix: supervisors blocked from starting a trip

## What we know

- جورجينا (line 10, سموحه 2) is correctly linked: her account is active and she is the supervisor of that line. She successfully started a trip on it this morning at 14:39 Cairo, so her data is not the problem.
- The permission rule for creating a trip is checked against the signed-in session. When the session has quietly expired or was replaced (another portal signed in on the same phone, app left open for hours), the screen still shows the old cached line and map, but the "start trip" write arrives with no valid identity and is rejected with exactly this message.
- The same expired-session cause explains the login trouble several supervisors report.
- The permission rule also has a weak spot: it compares the trip's driver and supervisor to the signed-in person's own ids. For a supervisor covering someone else's line, or a line with no driver assigned, the comparison can fail even though she is the right person.

## What will be done

1. Move trip creation to a secure server action
   - The portal calls a server function instead of writing the trip directly.
   - The server checks the caller's identity, confirms she is the driver or supervisor of that line (or the registered cover for today), then creates the trip, the student list and the parent notifications in one step.
   - Prevents duplicate trips: if a trip is already running on that line, it returns that trip instead of failing.

2. Clear, correct messages instead of the raw error
   - Session expired: an Arabic message telling her to sign in again, with a button that takes her to the login screen.
   - Not her line: a plain Arabic message saying she is not assigned to this line today.
   - No more raw "row-level security" text shown to staff.

3. Keep the session alive
   - On opening the driver/supervisor portal and before starting a trip, the session is refreshed; if refresh fails the person is sent to login rather than left on a stale screen.

4. Tighten the permission rule itself
   - Rewrite the create rule so it matches on the line's assignment (and today's coverage) rather than on possibly-empty id comparisons, so lines without an assigned driver and covering supervisors work.

## Technical notes

- New edge function `start-live-trip` (service role, `verify_jwt = false`, validates the bearer token with `supabaseAuth.auth.getClaims()`), replacing the client insert in `startTripMutation` inside `src/hooks/useLiveTrip.ts`. It resolves `driver_accounts` for the caller, validates against `routes.driver_id` / `routes.supervisor_id` and `staff_coverage` (`covering_supervisor_id` / `covering_driver_id` for today), then inserts `live_trips` + `trip_student_status` + `trip_notifications`.
- Migration replacing the `Drivers can start trips on their routes` INSERT policy on `live_trips` with a check based on route assignment/coverage instead of `driver_id = get_user_driver_id(...) OR supervisor_id = get_user_supervisor_id(...)`.
- `DriverTripInterface.tsx`: map returned error codes (`SESSION_EXPIRED`, `NOT_ASSIGNED`, `ALREADY_RUNNING`) to Arabic toasts; `DriverAuthContext.tsx`: refresh session on mount and expose a helper used before trip start.
- After deploying, confirm by starting a trip from a supervisor session and checking the created `live_trips` row.
