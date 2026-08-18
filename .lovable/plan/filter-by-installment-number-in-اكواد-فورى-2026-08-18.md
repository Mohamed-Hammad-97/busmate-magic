# Filter by installment number in اكواد فورى

Add a second dropdown next to the existing قسط/تأمين filter in the اكواد فورى tab: **رقم القسط**.

- Options: كل الأقساط (default), then القسط الأول، القسط الثانى، القسط الثالث... built from the installment numbers that actually exist in the loaded overdue rows.
- The dropdown is enabled only when الأقساط is selected in the type filter (التأمين is always installment 0, so a number filter makes no sense there). Switching the type filter back to الكل or التأمين resets it to كل الأقساط.
- Choosing a number shows only the students due for that installment, and the "إجمالي المستحق" box and row count update with the selection, same as the other filters.

## Technical notes
- `src/components/payments/FawryCodesTab.tsx` only.
- New `installmentNumber` state (`'all' | string`), a `useMemo` deriving the sorted distinct `installment_number > 0` values from `rows`, one extra `Select`, and one extra condition inside the existing `filtered` memo.
- Reset `installmentNumber` to `'all'` whenever `typeFilter` changes away from `installments`.
- No database or query changes.
