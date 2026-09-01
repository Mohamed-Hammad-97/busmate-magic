# Grade filter in Registrations + Excel export in اكواد فورى

## 1. Grade filter — Registrations tab
- Add a "Grade" dropdown next to the existing status/school filters in `src/pages/Registrations.tsx`.
- Options: All, KG1, KG2, Grade 1 … Grade 12 (static list matching stored grade values).
- Filter applies client-side on `registration.grade`, alongside the existing name/phone/school/status filters.

## 2. Excel export — اكواد فورى tab
- Add an "Excel" export button in the toolbar of `src/components/payments/FawryCodesTab.tsx`.
- Exports the currently **filtered** rows (respecting city, line, installment, subscription type, name/phone filters).
- Columns: Student, Parent, Payment Phone, School, Line (route name/number), Subscription Type, Installment (التأمين/القسط N), Amount, Due Date, Fawry Reference Code, Code Expiry, Notes.
- Use the existing `xlsx` library pattern (as in `src/lib/exportPayments.ts`) — build with `XLSX.utils.aoa_to_sheet` and save as `fawry-codes-<date>.xlsx`.

## Technical notes
- No database changes needed.
- Reuse `formatGrade` for grade display if needed in export.
- Verify build passes after changes.
