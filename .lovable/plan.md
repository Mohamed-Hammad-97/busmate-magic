# Fix supervisor login on OPPO and Redmi phones

## Confirmed diagnosis
- شيرين, عايدة, and رباب each have an active login linked to an active supervisor record.
- The hosted authentication and database services are healthy.
- The screenshot confirms the password is accepted, then the required supervisor-account lookup fails before navigation.
- The current account lookup goes back through the browser login client immediately after sign-in. On affected Android browsers, that second request can stall even though authentication already returned a valid session.

## Changes
1. **Make the post-login account check independent**
   - Use the access token returned by the successful password login to fetch the active driver/supervisor account directly.
   - Do not wait on another browser session or lock operation before accepting the account.
   - Keep the existing permission checks and reject missing or disabled accounts.

2. **Make the successful handoff durable**
   - Confirm the returned session is stored before leaving the login page.
   - Navigate directly to the requested trip or supervisor dashboard after the account is confirmed.
   - On page startup, recover the same account from the stored session without sending the user back to login during a slow read.

3. **Improve failure recovery and diagnosis**
   - Preserve a valid session when only account loading fails, so “إعادة المحاولة” works without re-entering the password.
   - Record the failing stage—login, session storage, account lookup, or navigation—without logging passwords or tokens.
   - Keep Arabic messages accurate and avoid calling a post-login loading failure a wrong password.

## Verification
- Test the login flow at an OPPO/Redmi-sized mobile viewport for all navigation states: dashboard and direct trip link.
- Verify no endless spinner, reload loop, horizontal overflow, or return to the login page.
- Confirm wrong-password and disabled-account behavior remains unchanged.
- Check the current build and browser logs, then publish so the fix reaches `seater.org` for testing on the affected phones.
