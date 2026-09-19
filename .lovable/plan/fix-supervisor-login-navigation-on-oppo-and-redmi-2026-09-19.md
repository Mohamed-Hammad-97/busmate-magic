# Fix supervisor login navigation on OPPO and Redmi

## Goal
Make a successful supervisor login reliably leave the login screen and open the supervisor dashboard on affected Android phones, while preserving normal behavior on other devices.

## Confirmed current behavior
- Login currently waits for up to 8 seconds for phone lookup, 20 seconds for password authentication, and two account-loading attempts of up to 8 seconds each.
- Navigation happens only after React receives both the accepted session and the active supervisor account.
- The shared authentication client uses persistent browser storage and the browser's native locking mechanism when available.
- Recent function logs show requests starting successfully, but they do not reveal the phone-side point where navigation stalls. The exact OPPO/Redmi browser failure therefore remains unconfirmed.

## Implementation
1. **Add a phone-safe authentication fallback**
   - Keep the normal login method as the first choice.
   - If it stalls on an affected browser, authenticate through the same secure authentication endpoint without depending on the browser lock that can hang on some ColorOS/MIUI browsers.
   - Validate the returned session and never store the password.

2. **Make successful navigation deterministic**
   - Persist the accepted session using the existing authentication storage format.
   - Use a full-page redirect to `/driver` after login so the dashboard starts from a clean browser state instead of waiting for a React state transition.
   - Preserve a requested trip URL when login began from a trip page.

3. **Shorten and separate failure handling**
   - Do not stack all lookup, login, and account-loading delays behind one spinner.
   - Show a clear retry action if authentication succeeds but account loading fails.
   - Keep inactive-account, unknown-phone, wrong-password, and network messages distinct.

4. **Prevent redirect loops**
   - During startup, do not classify the user as signed out until session recovery completes or the watchdog expires.
   - Never let a late empty session result overwrite a newly accepted session.

5. **Verify the result**
   - Test normal login, slow-response login, refreshed dashboard, and direct trip-page login.
   - Verify at a phone viewport with an OPPO/Redmi-style Android Chromium user agent.
   - Confirm no endless spinner, no return to login, no horizontal overflow, and no new console or build errors.

## Technical scope
- Update only the driver/supervisor authentication context and login page, plus a small authentication helper if needed.
- Do not modify supervisor records, passwords, permissions, or the generated backend client.
- No database changes are required.
