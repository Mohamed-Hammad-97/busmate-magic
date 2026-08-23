# Service-type dropdown when creating driver/supervisor accounts

## Problem
In Staff > Driver Accounts, the "create account" list is filtered by a hard-coded context (school), so drivers saved with only `corporate` or `daily_lines` categories never show up. The city filter narrows it further with no visible reason.

## What changes

1. **New "Service" dropdown in the create-account dialog**
   Options: مدارس (school), شركات (corporate), خطوط يومية (daily lines).
   Picking a service filters the driver/supervisor list to staff whose `categories` array contains that value (legacy `belongs_to` used as fallback for old rows without categories).

2. **Options limited by the signed-in employee**
   - Super admin: all three options.
   - `operations` department: مدارس.
   - `operation_companies`: شركات.
   - `operation_daily_lines`: خطوط يومية.
   Employees with several departments see all their matching options; the first allowed option is preselected. If only one option is allowed, it stays fixed.

3. **Clearer empty state**
   When no staff match, show why (service + city) plus a hint that the person may already have an account or belongs to another city, instead of an empty dropdown.

4. **City filtering stays** but is applied after the service filter, and staff records with an empty city are no longer dropped.

## Technical notes
- File: `src/components/staff/DriverAccountsManagement.tsx`.
- Replace the fixed `categoryValues` derived from `staffContext` with a `selectedService` state; `staffContext` only sets the default service.
- Read `isSuperAdmin` / `hasDepartment` from `useAuth` (`src/contexts/AuthContext.tsx`) to build the allowed option list.
- Include `selectedService` in the `available-drivers` / `available-supervisors` query keys so the lists refetch on change.
- The account list at the top of the tab also respects the selected service.
