# Reopen a finished daily line trip (super admin only)

## What changes
- In the Daily Lines admin, Trips list: completed trips get a "إعادة فتح الرحلة (Reopen trip)" button, visible to super admins only.
- Clicking asks for confirmation, then the trip goes back to "in progress" with everything kept: passengers, boarded/dropped marks, payments, stations, captain.
- The captain sees the trip again as active on his dashboard and can tap "Manage Passengers" to continue, then finish it normally.
- Customers' trip screen shows it as live again (bus tracking resumes once the captain's phone sends location).
- Customers who did not board are no longer shown as "Missed" while the trip is reopened (that label only applies to finished trips).

## Rules
- Only completed trips can be reopened (not cancelled ones).
- Only super admins; enforced on the server, not just hidden in the screen.
- Each reopen records who reopened it and when.

## Technical details
- Migration: add `reopened_at`, `reopened_by` to `daily_line_trips`; security-definer RPC `reopen_daily_line_trip(_trip_id)` checking `has_role(auth.uid(),'super_admin')` and `status='completed'`, sets `status='in_progress'`, clears `completed_at`, sets reopen fields. Adjust `enforce_daily_line_trip_update` if it blocks completed→in_progress (via `set_config` flag like the cancel RPCs).
- `DailyLinesAdmin.tsx`: button + confirm dialog calling the RPC, invalidate trip queries.
- `DriverDailyLineTrips.tsx` already renders in_progress trips with Manage Passengers; no change beyond verifying.
- Add a small bun test for the "can reopen" rule (completed + super admin only).
