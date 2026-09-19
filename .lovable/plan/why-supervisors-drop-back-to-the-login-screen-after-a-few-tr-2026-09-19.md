# Why supervisors drop back to the login screen after a few trips

## What the code shows

The supervisor session is kept alive by a timer inside the page, because automatic token renewal is turned off for the driver/supervisor portal. Three things in that setup explain the drop-outs after working for a while:

1. **The renewal timer is calculated from the login lifetime, not the time left.** Every tab schedules renewal roughly one hour ahead, even when the stored login is already 50 minutes old. Opening a trip in a new tab (which the portal does on every trip) restarts this wrong countdown, so the login can expire before any renewal happens.
2. **Each open tab renews on its own.** The dashboard tab and each trip tab all hold the same login and try to renew it separately. When one succeeds, the copies held by the other tabs become invalid, and those tabs can wipe or fail the next renewal.
3. **One failed trip start forces a sign-out.** When starting a trip reports an expired session, the app signs the supervisor out and sends them to the login page — exactly the behaviour they describe after several start/end cycles.

## Fix

1. Compute renewal from the actual remaining time of the stored login (with a safety margin), not from the original one-hour lifetime; renew immediately when it is already close to expiry.
2. Renew in only one place at a time: share the renewed login between tabs so trip tabs reuse the dashboard's fresh login instead of renewing in parallel; ignore renewal responses that are older than the currently stored login.
3. Before the trip start request, make sure the login is fresh; if the server still says it is expired, try one silent renewal and retry once before showing any message.
4. Stop forcing a sign-out on an expired-session message. Keep the supervisor on the page, show a short Arabic retry prompt, and only send them to the login screen if the silent renewal genuinely fails.
5. Renew after the phone wakes up: re-check the login when the page becomes visible again, since phone browsers freeze timers in the background.

## Verification

- Simulate a login that is nearly expired and confirm the portal renews it instead of bouncing to login.
- Run several start/end trip cycles in a row, including opening trips in new tabs, and confirm the supervisor stays signed in.
- Background the tab for a while, return, and confirm the dashboard and trips still work.
- Check the app diagnostics, then publish.

## Technical scope

Changes limited to `src/contexts/DriverAuthContext.tsx` (refresh scheduling, cross-tab reuse, visibility re-check), `src/lib/driverPortalClient.ts` if a storage-level adjustment is needed, and the trip start/end error handling in `src/hooks/useLiveTrip.ts`. No accounts, passwords, permissions, database records, or other portals change.
