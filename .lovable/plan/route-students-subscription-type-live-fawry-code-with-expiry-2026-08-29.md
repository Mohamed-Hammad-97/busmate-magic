# Route students: subscription type + live Fawry code with expiry

## Goal
In the Routes tab, when opening a line's students list, show two new columns next to "رقم الدفع والتجديد":
1. Subscription type (شهري / سنوي).
2. The Fawry reference code entered by finance in اكواد فورى, which expires automatically.

## Fawry code expiry

- When finance enters a reference code in اكواد فورى, they also enter how many hours it stays valid (e.g. 24). The row shows a small countdown / "ينتهي في ..." label.
- Once the hours pass, the code is treated as empty everywhere (Fawry tab cell, route students dialog, parent portal) and finance can enter a new one.
- When the installment is marked paid, or the row is cleared with the "تم" action, the code and its expiry are removed immediately.
- Expiry is computed from a stored expiry timestamp, so it works the same for every viewer without a background job.

## Route students dialog columns

Columns become: #, Student Name, Mother Phone, Payment Phone, **Subscription Type**, **Fawry Code**, Location Address, Map.

- Subscription type comes from the student's subscription (monthly → شهري / Monthly, yearly → سنوي / Yearly); "-" if no plan.
- Fawry code shows the newest still-valid, not-yet-paid, not-cleared installment code for that student, with the installment number under it (e.g. "القسط 2"). Empty if none valid.
- Both columns are added to the Excel and PDF exports as well.

## Technical notes

- Migration: add `fawry_code_expires_at timestamptz` (nullable) to `public.payments`. No breaking changes.
- `src/components/payments/FawryCodesTab.tsx`:
  - Add an "صلاحية (ساعات)" number input per row (finance/super admin only, default from a component-level default of 24). Saving the code sets `fawry_reference_code` and `fawry_code_expires_at = now + hours`; clearing the code sets both to null.
  - Treat a code as absent when `fawry_code_expires_at <= now`; render the cell empty and show an "انتهت الصلاحية" hint. A light interval tick re-renders so expiry appears without a manual refresh.
  - The paid/clear mutation also nulls `fawry_reference_code` and `fawry_code_expires_at`.
- Marking an installment paid elsewhere (`PaymentProfileDialog.tsx` / `Payments.tsx` paid mutations) also nulls both fawry fields in the same update.
- `src/components/routes/RouteStudentsDialog.tsx`: extend the select to `registrations -> subscriptions(subscription_type, payments(installment_number, status, fawry_reference_code, fawry_code_expires_at, fawry_cleared, due_date))`, pick the newest valid code client-side, add the two table columns plus `HEADERS`/row builders for xlsx and jspdf.
- Parent portal payment view filters out expired codes with the same rule.
- No RLS changes needed; employees already read `payments`.
