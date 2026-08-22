# Hide cancelled registrations from Payments and Routes

Cancelled registrations (cancelled before or after their plan was completed) should no longer appear anywhere in the Payments or Routes areas, and they should not occupy a seat on a line.

## 1. Routes tab

- When a registration is cancelled, its line assignment is removed, so the seat is freed and the student disappears from the line immediately.
- Everywhere a line's students are read, cancelled students are skipped as a safety net:
  - Line student counts and map pins
  - The line students dialog (screen list plus the Excel and PDF exports)
  - The cross-line student/phone search results
  - The manage-assignments dialog (current students list)
  - The driver/live-tracking student lists for a trip
- Complete Registrations tab already only lists `complete` records, so cancelled ones never show there.

## 2. Payments tabs

Cancelled registrations are already excluded from the Payments list, stats, reminders and اكواد فورى. This plan extends the same rule to the remaining paths so nothing leaks through:
- Archive tab rows
- Excel/PDF exports from the Payments tab
- The "changes by date" dialog and the new-records list
- Payment reminder detail pages

## Technical notes

- `src/pages/Registrations.tsx`: in the cancel mutation, also `delete from route_assignments where registration_id = ...` after setting status to `cancelled`, and invalidate the route queries.
- Add `status` to the `registrations(...)` selects in `src/pages/Routes.tsx` (both assignment queries), `src/components/routes/RouteStudentsDialog.tsx`, and the live-trip student queries, then filter out `status === 'cancelled'` client-side.
- `src/components/routes/ManageRouteAssignmentsDialog.tsx` already selects `status`; filter cancelled out of the assigned list.
- `src/pages/Payments.tsx`: make sure the archive list, export builders and the changes dialog all derive from the already-filtered `cityPayments` (not `allPayments`).
- No database schema changes.
