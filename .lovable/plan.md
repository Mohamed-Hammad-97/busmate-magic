# اكواد فورى — Line Filter + Subscription Type Column

## Answer to your question: why only القسط الأول / الثاني / التأمين appear

This is by design, not a bug. The Fawry tab only shows **overdue** installments — payments whose due date has already passed and are still unpaid. Installments 3, 4, 5, etc. are not due yet, so they don't appear until their due date passes.

If you want, I can change this (e.g. show all unpaid installments, or installments due within the next X days) — tell me which behavior you prefer. The plan below keeps the current overdue-only logic.

## Changes (in `src/components/payments/FawryCodesTab.tsx`)

### 1. Filter by line (route)
- Fetch route assignments: query `route_assignments` joined with `routes` (id, name, route_number) for the registrations appearing in the Fawry rows.
- Build a map: registration_id → route (name + number).
- Add a "الخط" (Line) dropdown filter listing all lines present in the current rows (All / each line / "بدون خط" for students not assigned to any line).
- Filtering works client-side alongside the existing city, phone, name, and installment filters.

### 2. Subscription type column
- The payments query already joins `subscriptions` — extend the select to include `subscription_type`.
- Add a new column "نوع الاشتراك" showing a badge: **شهري** (monthly) or **سنوي** (yearly).

## Notes
- No database changes needed (all fields already exist).
- No changes to the overdue-only row logic unless you ask for it.
