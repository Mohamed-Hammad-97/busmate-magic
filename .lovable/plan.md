# Fix: driver/supervisor login spins forever on phones

Account 01555044159 signs in fine on desktop, but on the phone the button just keeps loading and the login page never changes.

## What the login does today

When someone taps sign in, the app first asks the server which login address belongs to that phone number, waits for the answer, and only then signs in. That first request has no time limit and no visible failure: on a slow or dropping mobile connection it can hang, so the spinner keeps turning and nothing else happens. Desktop, on a stable connection, gets the answer instantly — which matches exactly what you are seeing.

A second possible cause on phones: some mobile browsers (private/incognito windows, or strict tracking settings on iPhone) block the storage the app uses to remember the sign-in. In that case the sign-in succeeds but is immediately forgotten and the person is dropped back on the login page with no error.

Both are unconfirmed until we reproduce, so step 1 is a real check, not a guess.

## Plan

1. Reproduce on a phone-sized browser session against this account's login screen, with the network throttled, and capture what the page does — confirm whether the request hangs or the session is being dropped.
2. Put a time limit (about 8 seconds) on the "which account is this phone?" lookup. If it doesn't answer in time, the app falls back to the standard login address and continues instead of hanging.
3. Never leave the button spinning: the loading state is cleared in every outcome, and any failure shows a clear Arabic message ("تعذر الاتصال بالإنترنت، حاول مرة أخرى" and similar) instead of silence.
4. Detect when the browser refuses to keep the sign-in, and show a short Arabic note telling the supervisor to leave private browsing / allow site data, rather than silently returning them to the login page.
5. Re-check on a phone-sized screen: normal login lands on the dashboard, slow network still lands on the dashboard, blocked-storage case shows the explanation.

## Technical notes

- `src/contexts/DriverAuthContext.tsx` — wrap the `driver-login-lookup` invoke in a `Promise.race` timeout, keep the existing `NOT_FOUND` / `INACTIVE` handling when the answer arrives in time, fall back to `driver_<phone>@seater.app` on timeout.
- `src/pages/DriverAuth.tsx` — ensure `setIsLoading(false)` runs in a `finally`, and add a storage-availability probe (write/read `localStorage`) that renders an inline Arabic warning when unavailable.
- No changes to accounts, permissions, database policies, or the recently fixed new-tab/returnTo behaviour.
