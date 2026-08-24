# Review of the two "error" security findings

Both findings describe column-level tampering that is already blocked in the database today.

## What I verified

- `daily_line_bookings` has an active BEFORE UPDATE guard (`trg_enforce_daily_line_booking_update`). For a parent-owned booking it rejects any change to payment status, payment method, prices, discount, promocode, boarding code, boarding/drop timestamps, ownership and trip. Parents can only change contact and pickup details.
- `registrations` has an active BEFORE UPDATE guard (`trg_enforce_parent_registration_update`). For a parent it rejects any change to status, school, grade, education department, car type, student name, ownership — leaving only the student photo (and comments) editable.

So the scanner is reading the access policies alone and not the guards that run on every write; the escalation paths it describes fail at runtime.

## Proposed work

1. Add a defence-in-depth check so the rule is visible in the policy itself, not only in the guard:
   - Booking updates by parents additionally require the financial and boarding values to stay equal to the stored row.
   - Registration updates by parents additionally require the non-photo values to stay equal to the stored row.
   This changes no app behaviour; it only makes the intent explicit for both reviewers and scanners.
2. Mark both findings as addressed and record in the security memory that these two tables are protected by write guards, so future scans do not re-raise them.

## Technical notes

- Step 1 is a single migration adding stricter conditions to the parent update policies on `daily_line_bookings` and `registrations`; the existing triggers stay in place.
- No frontend or edge function changes are needed — the parent portal only writes photo/contact/pickup fields.
