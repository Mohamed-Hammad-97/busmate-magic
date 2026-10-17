# Make the company portal "إنشاء حساب جديد" window scrollable

## What changes
- The "create new account" window in the company portal's Accounts page will scroll up and down when it's taller than the screen, so all fields, permissions and the create button are always reachable.
- On phones, the permissions list stacks into one column.
- Email and password boxes will no longer be auto-filled by the browser with your saved login.

## Technical details
- `src/components/corporate/CompanyAccountsManager.tsx`: add `max-h-[90vh] overflow-y-auto` to `DialogContent`; permissions grid `grid-cols-1 sm:grid-cols-2`; add `autoComplete="off"` on email and `autoComplete="new-password"` on password.
