# One family, one parent login

## The problem

The same family exists in the system more than once: one record created with the father's number, another created with the mother's number (sometimes 3-4 records). Each of those records got its own separate login, so signing in with the mother's number opens a different, half-empty account instead of the family's real one.

Checked on live data: 618 parent records, 28 mother numbers appear on more than one record, and 14 records have a mother number that is another record's father number. 183 records have no login attached at all.

## The fix

Keep the existing records as they are, but make every record that shares a phone number belong to **one single login**. Whichever number the parent uses - father's or mother's, with or without the leading 0 or +20 - they land in the same account and see all of their children together.

1. **Link existing families.** Group records that share any phone number (father or mother, compared after stripping spaces, 0 and +20). Each group gets one login, chosen as the oldest existing one; the other records in the group are attached to that same login. Nothing is deleted, no child, payment, trip or chat record moves.

2. **Link at sign-in too.** Both sign-in paths (code by SMS and password) will look up the whole family for the entered number, attach any family record that still has no login, and always sign the parent into the family's single login. This also covers the 183 records with no login, and future duplicates created by new registrations.

3. **Show the whole family in the portal.** The portal currently reads one record per login. It will read all records belonging to the login, so the children list, payments, trips, absences and chats cover the full family. New items the parent creates (a booking, an absence) stay attached to the family's main record.

## Technical details

- Data backfill through a one-off SQL update: normalise `father_phone`/`mother_phone` (strip non-digits, leading `20`/`0`), build connected groups over shared numbers, pick canonical `user_id` = oldest non-null, set `user_id` on all group rows. `public.get_user_parent_ids(uuid)` already returns every `parent_accounts` row for a user, so RLS across registrations, payments, bookings, chats and absences widens automatically.
- `supabase/functions/verify-otp` and `supabase/functions/parent-password-login`: replace single-row phone lookup with a two-pass family resolve (match by phone variants, then expand to rows sharing any phone with the matches), reuse the canonical `user_id`, backfill `user_id` on sibling rows, and only create a new auth user when the whole family has none. Password path drops `.not("user_id","is",null)` and instead resolves through the family.
- `src/contexts/ParentAuthContext.tsx`: `fetchParentAccount` uses `.maybeSingle()` on `user_id`, which now errors with multiple rows. Change to an ordered list; expose `parentAccount` (primary = oldest row) plus `parentAccountIds`.
- Switch reads from `.eq("parent_id", parentAccount.id)` to `.in("parent_id", parentAccountIds)` in `ParentDashboard.tsx`, `DailyLinePortal.tsx`, `ParentServiceSelector.tsx`, `AbsenceRegistration.tsx`, `ParentChat.tsx`, `ParentLiveTracking.tsx`. Inserts keep `parentAccount.id`.
- Verification: re-run the duplicate query after the backfill to confirm every phone-linked group resolves to one `user_id`, and sign in as a known split family (father number, then mother number) to confirm both reach the same children list.
