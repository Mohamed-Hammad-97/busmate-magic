# Fix stuck logins + remove SMS code for second child

## 1. Staff login (/auth) stops spinning forever
- Keep the loading state on until the user's role and employee profile have finished loading (with a timeout so it can never hang).
- After a successful sign-in, go straight to the dashboard.
- Protected pages wait for the role instead of bouncing back to login.

## 2. Parent login (/parent/auth)
- Keep loading until the family's parent records have loaded (with timeout).
- After OTP or password success, go straight to the parent portal.
- "Account not found" only shows once loading truly finished and no record exists.

## 3. Second child registration - no SMS code
- Restore the previous behaviour: an existing parent (same phone) can add another child directly, without a verification code.
- Remove the code prompt from the registration form.

## Technical details
- `AuthContext.tsx`: `fetchUserData` awaited before `setIsLoading(false)` in both `onAuthStateChange` and `getSession`; 10s timeout; `Auth.tsx` navigates to `/dashboard` after `signIn` resolves and role is present.
- `ParentAuthContext.tsx`: same pattern around `fetchParentAccount`; `ParentAuth.tsx` navigates after success.
- `public-register/index.ts`: remove `verifyFamilyOtp` calls (lines ~269-316); redeploy. `StudentRegistrationForm.tsx`: drop `OTP_REQUIRED` handling.
- Verify with Playwright: staff and parent login reach their dashboards; second-child registration submits without a code.
- Publish afterwards so seater.org gets the fix.
