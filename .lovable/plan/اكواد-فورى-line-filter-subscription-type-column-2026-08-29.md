# اكواد فورى — Line Filter + Subscription Type Column

## Updated row visibility rule

The Fawry tab will now show:
- **Overdue** installments (due date already passed), as before.
- **Upcoming installments due within the next 7 days** so customer service can generate Fawry codes early.

The "إجمالي المستحق" label and total will still sum all displayed rows.

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
