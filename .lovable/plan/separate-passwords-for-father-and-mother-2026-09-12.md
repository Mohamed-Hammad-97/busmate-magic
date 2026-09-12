# Separate passwords for father and mother

## Goal

Today a family has one shared login, so one password works for both the father's and the mother's number. After this change, each phone number has its own password. Whoever signs in with his or her own number and password lands in the same family account and continues the normal flow (children, payments, trips, chats).

## How it will work

1. Passwords are stored per phone number, not per family. Setting or changing a password only affects the number that was used to sign in.
2. On sign-in, the entered number is matched to its own password. A wrong password no longer silently tries the other parent's password; the parent is offered the SMS code instead.
3. After a successful password check, the parent is signed into the family's single account exactly as today, so the rest of the app is unchanged.
4. First time a parent signs in by SMS code, the app offers to set a password for that number. The other parent keeps (or can separately create) their own.
5. Existing saved passwords keep working: on the next successful sign-in with a number, that password is stored as that number's own password, and both parents can then set their own.

## Technical details

- New table `public.parent_phone_credentials`: `id`, `phone_normalized` (unique), `family_id`, `parent_account_id`, `password_hash`, `created_at`, `updated_at`. RLS: no client access at all (edge functions only, via service role); grants for `service_role` only.
- Hashing reuses `supabase/functions/_shared/password-utils.ts` (PBKDF2), the same scheme already used elsewhere.
- `supabase/functions/parent-password-login`: normalize the phone, resolve the family (`_shared/parent-family.ts`), look up `parent_phone_credentials` for that exact number, verify with `verifyPassword`. Legacy fallback: if no credential row exists, try the family's Supabase Auth password once and, on success, write the credential row for that number. On success, mint the session for the family's primary `user_id` using the existing `generateLink({type:"magiclink"}) + verifyOtp` pattern from `verify-otp` (no Auth-password sign-in, so no shared password). Failure keeps the current `needs_otp: true` recovery response.
- New function `supabase/functions/set-parent-password`: takes the caller's JWT plus the phone used to sign in, verifies that the number belongs to the signed-in family, and upserts the hashed credential. It must not call `auth.updateUser`, which would change the shared Auth password.
- `check-parent-auth`: unchanged (keeps its anti-enumeration response).
- Frontend: `ParentAuthContext` remembers the phone used at sign-in (state + `sessionStorage`) and exposes it; `SetPasswordDialog` calls the new edge function with that phone instead of `supabase.auth.updateUser`; `parent_accounts.has_password` keeps marking "this record has set a password" for the prompt in `ParentDashboard`.
- Verification: sign in with the father's number and its password, then with the mother's number and a different password, and confirm both reach the same children list and that each password fails on the other number.
