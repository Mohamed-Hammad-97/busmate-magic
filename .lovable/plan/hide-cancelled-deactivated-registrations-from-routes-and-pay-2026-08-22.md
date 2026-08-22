# Hide cancelled / deactivated registrations from Routes and Payments

## Scope
A registration is treated as hidden when:
- its status is `cancelled`, or
- its parent account is deactivated (`parent_accounts.is_active = false`).

Nothing is deleted — restoring the registration or reactivating the parent brings the data back.

## Routes tab
- Route student counts and the map markers no longer include hidden students.
- The route students dialog (roster) skips them, and the Excel/PDF exports match what is shown.
- The cross-line student/phone search never returns hidden students.
- Complete registrations tab and the manage-assignments dialog stop listing them as assignable.

## Payments tab
- Payments list, stats, totals, overdue reminders card, reminder details page and اكواد فورى all skip installments belonging to hidden registrations (cancelled is already handled; deactivated parents added).

## Technical notes
- Add `status` to the registration select and `is_active` to the `parent_accounts` select in: `src/pages/Routes.tsx` (both assignment queries), `src/components/routes/RouteStudentsDialog.tsx`, `src/components/routes/CompleteRegistrationsTab.tsx`, `src/components/routes/ManageRouteAssignmentsDialog.tsx`.
- Shared client-side predicate: skip when `reg.status === 'cancelled' || parent.is_active === false`; apply before counts, map points, roster rows, export rows and search matches.
- In `src/pages/Payments.tsx`, `src/pages/PaymentReminderDetails.tsx` and `src/components/payments/FawryCodesTab.tsx`, extend the existing cancelled filter with the parent `is_active` check (add `is_active` to the parent select).
- `src/components/payments/PaymentReminders.tsx` receives already-filtered payments from Payments, so no query change there.
- No database changes.
