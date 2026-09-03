# Fix Fawry code validity hours

## Problem
In اكواد فورى, the hours field is only used at the moment the code text itself is changed. Changing the hours number alone never saves, so every code keeps whatever expiry it was first given (usually 24h). The hours box also always displays "24" after a refresh, even when the stored expiry is different, so finance and customer service both see a wrong number.

## What will change

1. **Editing hours saves immediately.** When finance changes the hours value and leaves the field (or presses Enter), the expiry is recalculated from now and saved to the row. The code stays the same; only its validity window changes.
2. **The hours box shows the real value.** Instead of a hardcoded 24, the box is filled from the stored expiry (hours remaining, rounded up). 24 is used only as the default for a row with no code yet.
3. **Everyone sees the same thing.** Customer service (read-only) sees the same hours value and the same "ينتهي ..." / "انتهت الصلاحية" label as finance, just not editable.
4. **The countdown label refreshes** on a light interval so an expiring code flips to "انتهت الصلاحية" without a manual reload, and the code disappears at exactly the entered hour count, not always 24h.

## Technical notes
- `src/components/payments/FawryCodesTab.tsx` only; no database or RLS changes.
- Derive the draft `hours` from `fawry_code_expires_at` in the drafts initializer, falling back to `'24'`.
- Add an `onBlur`/Enter handler on the hours input: if a valid code exists and the entered hours differ from the stored remaining hours, mutate `fawry_code_expires_at = now + hours*3600s`.
- Keep the existing code-change handler using the current draft hours.
- Show the expiry label whenever `fawry_code_expires_at` is set, regardless of `canSetReference`.
