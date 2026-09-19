# Fix OPPO and Redmi driver/supervisor login

## Confirmed issue

The password request can succeed, but the login page only opens the portal after a separate account-details request finishes. On slower or aggressively managed Android browsers, that second request can time out twice and return no account. The current login function still reports success, leaving the person on the login page without an error.

The affected phone numbers do not appear in recent `driver-login-lookup` logs, so the fix must not depend on that preliminary request completing reliably.

## Changes

1. **Make login one complete operation**
   - After password acceptance, use the returned session directly and load the linked driver/supervisor account before reporting login success.
   - Do not rely only on a delayed background authentication event to navigate.
   - Prevent older startup checks from replacing the newly accepted session.

2. **Make account loading resilient on Android phones**
   - Fetch the small `driver_accounts` record first, then fetch the linked driver or supervisor details separately.
   - Retry transient failures with a short delay instead of issuing two immediate identical requests.
   - Preserve the valid session while retrying; never silently treat an account-request timeout as “logged out.”

3. **Show a recoverable state instead of staying on login**
   - If the password succeeds but account details cannot load, show a clear Arabic connection message and a retry button.
   - Retry account loading without asking for the password again.
   - Keep wrong-password, disabled-account, and unknown-number messages distinct.

4. **Verify the complete phone flow**
   - Test both affected accounts through the same login path at a 390×844 phone viewport.
   - Simulate a slow account response and confirm the spinner ends, the valid session remains, and retry opens the dashboard.
   - Confirm normal login, refresh, logout, and opening a trip in a new tab still work.
   - Check the latest runtime and build signals before completion.

## Technical scope

Only the driver/supervisor authentication context and login screen will change. Account data, passwords, permissions, and the employee portal will not be changed.
