# Fix supervisor 01555044159 being sent back to login when opening a trip

## Confirmed findings
- The account for **رباب على عبد العظيم** (`01555044159`) is active, linked to an active supervisor record, and signed in successfully today.
- She is assigned to active lines **#900 Test** and **#7 ابراهميه**, and she has successfully started trips before.
- The remaining failure is in the browser session handoff: opening the trip in a second tab can trigger overlapping session checks/refreshes. One late result can temporarily clear the valid session, causing the trip page to redirect to login.
- The login page always redirects an authenticated person to `/driver`, so after that temporary redirect it loses the requested trip address and returns only to the dashboard.

## Changes
1. **Make driver/supervisor session initialization race-safe**
   - Use one authoritative initial session resolution in `DriverAuthContext`.
   - Prevent an older asynchronous account/session lookup from overwriting a newer valid result.
   - Do not force an unnecessary token refresh whenever a new tab opens; rely on the saved valid session and automatic refresh.
   - Keep the loading screen visible until the final session and account result are both known.

2. **Preserve the requested trip address**
   - When a protected trip page truly needs login, include its full address as the return destination.
   - After successful login, return to that trip instead of always sending the supervisor to the dashboard.
   - Accept only internal `/driver/...` return addresses.

3. **Keep account and trip permissions unchanged**
   - No account, route assignment, trip data, or permission changes.
   - The fix applies to drivers and supervisors using the same portal.

## Verification
- Confirm the app builds successfully.
- On a phone-sized browser, sign in as the affected supervisor, tap **بدء الرحلة**, and verify the new tab stays on `/driver/trip/<line-id>` without showing login.
- Reload that trip tab and confirm it remains on the trip.
- Confirm a genuinely signed-out visitor is sent to login and then returned to the original trip after signing in.
