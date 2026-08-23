# Fix: newly added drivers missing from the account-creation list

## Cause (verified)

Two separate issues:

1. **Category filtering.** The four drivers added today (رمضان, محمد الشافعي, إبراهيم, ابو أحمد) were saved with category "corporate". The "Create account" dropdown inside the Staff page only lists staff whose legacy `belongs_to` value is `school` or `both`, so any driver saved as corporate-only — and any driver saved as daily-lines-only, which is silently stored as `school` — is filtered out or mis-filtered. Categories are stored properly in the `categories` array, but the account list ignores that array and uses the old single-value field.

2. **Stale list after saving.** Saving a driver only refreshes the staff table, not the "available drivers/supervisors" list used by the account dialog. Until the page is reloaded, a just-added driver will not appear even when the category matches.

## What changes

- The account-creation dropdown filters on the real `categories` array instead of the legacy field, so a driver appears wherever their categories say they belong (school, corporate, daily lines, or several at once).
- Drivers/supervisors marked for daily lines show up in the Staff account list too, instead of being lumped into school by accident.
- After adding or editing a driver or supervisor, the available-staff list refreshes immediately — no page reload needed.
- The existing city filter and the "already has an account" exclusion stay exactly as they are.

## Technical notes

- `src/components/staff/DriverAccountsManagement.tsx`: replace the `.in("belongs_to", belongsToValues)` filters on `drivers` and `supervisors` with a `categories` overlap check (`.overlaps("categories", [...])`), falling back to `belongs_to` for legacy rows with an empty `categories` array. Same change for the `filteredAccounts` memo. Add `cityFilter` and the account list to the `available-drivers` / `available-supervisors` query keys.
- `src/pages/Staff.tsx`: after the driver and supervisor save mutations, also invalidate `['available-drivers']` and `['available-supervisors']`.
- No database or schema changes.
