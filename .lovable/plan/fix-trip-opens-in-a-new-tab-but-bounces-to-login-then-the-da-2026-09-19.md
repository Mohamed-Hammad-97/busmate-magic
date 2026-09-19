# Fix: trip opens in a new tab but bounces to login, then the dashboard

## What's happening

When a driver/supervisor taps "Start trip", the new tab opens the trip page. Before the page can show, the app checks "is this person logged in AND do they have a driver/supervisor account?". The login session loads instantly (it's saved on the phone), but loading the account record takes a moment over the network. The gate currently stops waiting as soon as the session loads — while the account is still being fetched — so it wrongly concludes "not logged in" and sends the tab to the login page. A split second later the account finishes loading, the login page sees the person IS logged in, and sends them to the dashboard. Result: the trip page never appears — exactly the "login, then dashboard only" loop you saw.

## Fix (one file: the driver/supervisor login logic)

Make the login gate wait until BOTH the session and the account record have finished loading:

1. In `src/contexts/DriverAuthContext.tsx`, only mark loading as finished after the account lookup completes (success or "no account"), instead of right after the session loads.
2. No changes needed to the route guard or the login page — once the gate waits properly, the new tab goes straight to the trip screen.

## Verification

- Build passes.
- With Playwright (phone-sized screen): sign in as a driver in the preview, open `/driver/trip/<id>` directly in a fresh tab, and confirm the trip screen appears with no login flash and no bounce to the dashboard.

## Note

This affects the preview now; the new-tab trip feature itself is still waiting to be published to seater.org (previous message). This fix will be included when you publish.
