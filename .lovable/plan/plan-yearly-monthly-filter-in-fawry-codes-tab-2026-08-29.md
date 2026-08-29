# Plan: Yearly/Monthly Filter in Fawry Codes Tab

## Goal
Add a filter to "اكواد فورى" so employees can show only yearly or only monthly subscription installments.

## What will change
- In `src/components/payments/FawryCodesTab.tsx`, add a new dropdown filter beside the existing type/line filters.
- Filter options:
  - الكل (all)
  - سنوي (yearly)
  - شهري (monthly)
- The filter will compare against `subscriptions.subscription_type` already returned by the existing query.
- The existing subscription-type column will remain visible; the filter only narrows the rows.
- No backend or database changes are required because `subscription_type` is already fetched and displayed.

## Implementation steps
1. Add local state `subscriptionTypeFilter: 'all' | 'yearly' | 'monthly'`.
2. Add a `<Select>` in the filter row with the three options and Arabic labels.
3. Extend the `filtered` `useMemo` to skip rows whose `subscriptions.subscription_type` does not match when the filter is not "all".
4. Verify the filter works together with the existing line, installment, phone, name, and search filters.
5. Run `bun run build` to confirm no TypeScript errors.

## Out of scope
- No changes to payment records, exports, or parent portal.
- No new database columns or migrations.
