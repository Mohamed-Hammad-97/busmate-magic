# Fawry filter, route search, payment phone, cancelled plans

## 1. Filter in اكواد فورى by القسط والتأمين
Add a dropdown next to the existing search/phone/name filters in the Fawry tab:
- الكل (default)
- التأمين (installment number 0)
- الأقساط (installment number 1 and above)

Filtering happens on the already loaded rows, and the "إجمالي المستحق" box updates with the filter.

## 2. Search students across all routes (Routes tab)
Add a second search box in the Routes tab that searches by student name or phone (father / mother / payment phone) across every route, not just route names. Results show a small list of matches: student name, the line number and name, the school, and the phone matched. Clicking a match opens that route's student dialog.

## 3. رقم الدفع والتجديد in route student cards and exports
Add the payment phone next to the mother phone in the route students dialog table, and add it as its own column in both the Excel and PDF exports of that dialog.

## 4. Cancelled registrations hide their payment plans
When a registration is cancelled, its subscription, installments and dues are hidden everywhere:
- Payments tab list, stats and totals
- Overdue reminders card
- اكواد فورى tab
- Change/date filters and exports

Data stays in the database, so restoring a cancelled registration brings the payment plan back automatically.

## Technical notes
- `src/components/payments/FawryCodesTab.tsx`: new `installmentType` state + `Select`, applied inside the existing `filtered` memo; also skip rows whose registration status is `cancelled`.
- `src/pages/Routes.tsx`: new query joining `route_assignments -> registrations -> parent_accounts` (student name, phones) for the active school/city scope; client-side match on name/normalized phone; reuse `RouteStudentsDialog` for the result click.
- `src/components/routes/RouteStudentsDialog.tsx`: select `payment_phone` from `parent_accounts`, add table column and add to `HEADERS`/row builders for the xlsx and jspdf exports.
- `src/pages/Payments.tsx` and `src/components/payments/PaymentReminders.tsx`: extend the existing archived-registration exclusion to also exclude `status === 'cancelled'` in every grouped/filtered/stats path.
- No database changes.
