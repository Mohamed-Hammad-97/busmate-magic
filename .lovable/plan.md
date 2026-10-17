# Company accounts in the edit-company window

## What changes
When you edit a company, the account section becomes:

1. **Existing login accounts (fixed email)** — every login already created for the company is listed with its email shown read-only, so it can't be changed. (Today the email box is empty and your browser auto-fills your own email into it, as in your screenshot.)
2. **Change password** — each listed account gets a "change password" field and a save button. Only the password changes.
3. **Add another account** — a button "إضافة حساب آخر" opens email + password fields to create an extra login for the same company. It stays hidden until you press it, so nothing is created by accident.

Creating a brand-new company stays the same: email and password are required.

## Technical details
- `src/pages/Corporate.tsx`: in edit mode, load `company_accounts` (id, email, full_name, is_active) for the selected company; render read-only email rows with a password input per row; remove the old optional email/password pair from the save flow in edit mode; add a toggled "add account" sub-form that calls the existing `create-company-account` function. Add `autoComplete="off"` / `new-password` so the browser stops auto-filling.
- `supabase/functions/create-company-account/index.ts`: add an `action: "reset-password"` branch (same super_admin / operation_companies check, account must belong to the given company, min 6 characters, hashed with the existing password helper). Deploy it.

## Verification
- Edit a company: emails show read-only, a password change saves and the company portal accepts the new password, and an added account appears in the list.
