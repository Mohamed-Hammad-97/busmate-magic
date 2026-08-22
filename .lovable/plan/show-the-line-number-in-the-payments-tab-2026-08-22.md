# Show the line number in the payments tab

Finance staff need to know which bus line each student belongs to while working inside the payments tab, and to pull up every student on a given line.

## What changes

1. **New "Line" column** in the payments summary table (grouped-by-student view), placed right after School. It shows the route number (and route name as a tooltip/secondary text). Students not yet assigned to a line show `-`.
2. **New "Filter by line number" input** next to the existing phone and name filters. Typing a line number narrows the table to the students assigned to that line, so the finance employee sees the full roster of that line with their payment status.
3. The line value also flows into the places that reuse the summary rows: the finance "changes by date" dialog rows and the payments export (Excel/PDF), so exported records carry the line number too.

## Technical notes

- Line numbers live on `routes.route_number`, linked to a student through `route_assignments.registration_id`. There is no direct relation from `payments` to routes, so the payments page will run one extra lightweight query (`route_assignments` joined to `routes(route_number, name)`) and build a `registrationId -> { routeNumber, routeName }` map.
- Assignments for cancelled registrations are already removed on cancel, and the payments list already filters out cancelled registrations, so no extra filtering is needed there.
- `paymentsByRegistration` in `src/pages/Payments.tsx` gains `lineNumber` / `lineName` fields, fed from the map; `filteredGrouped` gains a `lineFilter` check (exact match on the typed number, ignoring blanks).
- Files touched: `src/pages/Payments.tsx` (query, grouping, filter state, table column) and `src/lib/exportPayments.ts` (extra column in Excel/PDF output).
- No database changes required.
