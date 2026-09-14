# Fix supervisor login problems

## What I found in the data

I checked all eight names against the supervisor list and their login accounts.


| Supervisor      | Status                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| بسمة محمد محمود | Account active, signed in 27 Aug. Duplicate supervisor record exists with no account.                                                                  |
| رباب على        | Account active, signed in today.                                                                                                                       |
| نهلة محمود      | **Broken.** Her phone is 01281551672, but her login is tied to 01550832871. A second, disabled account exists on 01007212486. She has never signed in. |
| رشا رمضان       | Account active, signed in 10 Sep.                                                                                                                      |
| ولاء            | Two different people named ولاء; both accounts active and both have signed in.                                                                         |
| امينة محمود     | Account active, signed in 2 Sep.                                                                                                                       |
| اية             | **No supervisor record and no account exist under this name at all.**                                                                                  |
| شيرين مجدى      | Account active, signed in today.                                                                                                                       |


So there are three separate problems, not one:

1. Login phone does not match the real phone (نهلة, and also عايده and منه الله, who have the same mismatch).
2. A supervisor with no account at all (اية).
3. The rest have working accounts and have signed in recently — for them the likely cause is a forgotten/changed password or an expired session, and today there is no way for the office to reset a supervisor password or see which phone her login actually uses.

## What I will build

**1. Sign in with the phone she actually knows**

Today the app turns whatever phone is typed into a hidden login address, so if the account was created on a different number she can never get in. I will add a server-side lookup that finds her account by either her personal phone or her account phone, and signs her in with the right one. Trailing spaces and stray characters in stored numbers are cleaned up in the lookup.

**2. Reset password and change login phone from the staff screen**

On the driver/supervisor accounts screen the office gets, per account:

- "Reset password" — set a new password and show it once, to read out to her.
- "Change login phone" — update the number she signs in with, kept in sync with her record.
- The phone her login currently uses, shown on the card, plus a warning badge when it differs from her staff record.

**3. Clean up the broken records**

- Point نهلة's active account at her real number 01281551672 and remove her duplicate disabled account and duplicate supervisor record.
- Same phone correction for عايده and منه الله.
- Remove the duplicate بسمة supervisor record that has no account.

**4. Clearer error messages**

Wrong password, unknown phone, and disabled account each show their own Arabic message instead of one generic failure, so the office can tell instantly which case it is.

## Technical notes

- New edge function `driver-login-lookup` (service role, `verify_jwt = false`): takes a phone, normalizes digits, matches `driver_accounts.phone` or the linked `drivers`/`supervisors` phone, returns the auth email plus an `is_active` flag; returns distinct codes `NOT_FOUND` / `INACTIVE`. `DriverAuthContext.signIn` calls it before `signInWithPassword` instead of building `driver_<phone>@seater.app` locally.
- New edge function `manage-driver-account` (service role, operations/super_admin only, same authorization pattern as `create-driver-account`): actions `reset_password` (admin `updateUserById`) and `update_phone` (updates auth email + `driver_accounts.phone` atomically, rolls back on failure).
- `DriverAccountsManagement.tsx`: add the two actions, show account phone and a mismatch badge derived from `normalize_eg_phone`-style digit comparison.
- Data corrections applied as a one-off migration, phone values normalized with `regexp_replace(phone,'\D','','g')` before comparison.
- No RLS or schema changes beyond the data corrections.