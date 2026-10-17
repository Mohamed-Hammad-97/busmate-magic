# Choose pickup method for the employee registration form

## What changes
- In the company portal, next to the employee registration link, the company admin/supervisor gets a "Pickup method" setting with three choices:
  - Select line only
  - Custom pickup (map) only
  - Both (employee chooses) — the default, same as today
- The public employee registration form follows this setting:
  - Line only: shows only the line list (map hidden).
  - Custom only: shows only the map pickup point.
  - Both: shows the current toggle.
- If "Line only" is chosen but the company has no lines, the form falls back to the map so employees can still register.
- The server also enforces the setting, so a submission using a disallowed method is rejected.

## Technical details
- Migration: add `employee_pickup_mode text not null default 'both'` with check (`line`,`custom`,`both`) to `public.companies`.
- `company-portal-data` edge function: new action `update-pickup-mode` (company admin or account with `manage_accounts` permission); return the mode with company data.
- `company-employee-register` edge function: return `pickup_mode` with lines; validate submitted method against it.
- `src/pages/CompanyDashboard.tsx`: selector card beside the registration link.
- `src/pages/CompanyEmployeeRegister.tsx`: hide/show the toggle, line select and map per mode.
- Regenerate types; deploy both functions.
