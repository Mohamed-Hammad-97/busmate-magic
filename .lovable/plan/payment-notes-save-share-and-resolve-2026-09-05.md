# Payment notes: save, share, and resolve

The notes boxes in the payments area silently fail to save for everyone except finance staff, so the text vanishes on refresh and other employees never see it. This fixes saving, makes notes visible to all employees, and adds a "resolved" state.

## What changes for users

- Typing a note in the اكواد فورى list or beside an installment in a customer's payment plan saves immediately and stays after refresh.
- Every employee who can open the payments area sees the same note text, plus who wrote it and when.
- Notes can be edited at any time by finance, customer service, and admins.
- Each note has a "تم الحل" (Resolved) action. Resolved notes keep their text but are shown greyed out with a resolved badge, showing who resolved it and when. A resolved note can be reopened.
- A small filter above the اكواد فورى list lets staff show all notes or only unresolved ones.
- If saving ever fails, an error message appears instead of the note quietly disappearing.

## Why it fails today

The payments table only allows finance staff to make changes. Customer service (and admins without the finance tag) can type in the notes box, but the save is rejected with zero rows changed and no error, so the text is lost on the next refresh.

## Technical details

Database migration:
- Add to `public.payments`: `payment_note_resolved_at timestamptz`, `payment_note_resolved_by uuid`, `payment_note_updated_at timestamptz`, `payment_note_updated_by uuid`, and the same four for `fawry_note`.
- Add a `SECURITY DEFINER` function `public.set_payment_note(_payment_id uuid, _field text, _note text, _resolved boolean)` that:
  - verifies the caller is `super_admin`, or has department `finance` or `customer_support`;
  - accepts only `'payment_note'` or `'fawry_note'` for `_field`;
  - updates only that note column plus its resolved/updated metadata (never amounts, status, or Fawry codes);
  - stamps `*_updated_by` from `auth.uid()`'s employee id.
- `GRANT EXECUTE` on the function to `authenticated`; keep table-level UPDATE unchanged so no other column becomes writable.
- Add a payments UPDATE policy for `super_admin` so admins are not blocked on the other existing edit actions.

Frontend:
- `src/components/payments/FawryCodesTab.tsx`: route the ملاحظات blur-save through the new function via `supabase.rpc`, surface errors with a toast, render author/timestamp and a resolve/reopen button per row, and add the all/unresolved filter.
- `src/components/payments/PaymentProfileDialog.tsx`: route the قيد الدفع note save (both the inline note mutation and the edit-row save) through the same function, and add the resolved badge plus resolve/reopen control.
- `src/pages/Payments.tsx`: show the resolved state in the Note column of the summary table.
- Excel/PDF exports that already include the note gain a "حالة الملاحظة" column (resolved / open).
