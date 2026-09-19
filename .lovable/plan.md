# Stabilize supervisor login on OPPO and Redmi

## Confirmed issue
The password is accepted and the supervisor account loads, but the initial authentication check can still deliver a delayed empty `INITIAL_SESSION` event. The current listener treats that empty event as a logout and clears the newly accepted session, so the dashboard appears briefly before returning to the login page.

## Changes
1. Harden the driver authentication listener so a delayed empty startup event cannot replace a newer successful login.
2. Process a real `SIGNED_OUT` event normally, while ignoring stale null startup results once a valid session has been accepted.
3. Add a generation/token guard around session application so older asynchronous account lookups cannot clear or overwrite newer authenticated state.
4. Keep the user on the dashboard during temporary account refreshes instead of treating a transient refresh as logout.
5. Preserve the existing explicit retry message when the password succeeds but account data genuinely cannot load.

## Verification
- Reproduce the race by delaying the initial empty session result until after a successful login, and confirm it no longer redirects.
- Confirm explicit logout still returns to the login page.
- Test the login and dashboard at the OPPO/Redmi phone viewport, including reload and opening a trip.
- Check the app diagnostics after the changes and publish only after verification.

## Technical scope
Changes will be limited to the driver/supervisor authentication context and its route guard or focused tests if needed. No account records, passwords, permissions, or other portals will be changed.
