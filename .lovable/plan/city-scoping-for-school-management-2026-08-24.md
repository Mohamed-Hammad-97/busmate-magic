# City scoping for School Management

School Management (attendance, advances, coverage, salaries) currently loads every school, route, driver and supervisor regardless of the city selector. Other pages (Routes, Registrations) already scope data to the employee's assigned city. This plan brings School Management in line.

## What changes

- Schools dropdown: only schools in the active city.
- Routes/lines lists and route dropdowns in the drivers and supervisors attendance tabs: only lines whose school is in the active city.
- Drivers and supervisors lists used by السلف (advances), التغطية (coverage) and the salaries tab: only staff whose city matches the active city.
- Super admins keep the "All Cities" option; employees assigned to one or more cities only ever see those cities' data (this is already enforced by the city selector).

## Technical notes

- Reuse `useCity()` from `src/contexts/CityContext.tsx` (`selectedCity`) plus the existing EN/AR city-name mapping used in `src/pages/Routes.tsx`.
- Add a small shared helper in `src/components/school/schoolStaff.ts` (e.g. `cityNamesFor(selectedCity)` and a `matchesCity(value)` predicate) so all four school components filter identically instead of duplicating the mapping.
- `SchoolAttendance.tsx`: select `schools(name, city)` on the routes query and filter routes/route options by school city; filter the schools query by city.
- `useSchoolStaff()` in `schoolStaff.ts`: also select `city` and filter by the active city; pass the selected city into the query key so lists refresh when the city changes.
- `SchoolSalaries.tsx`, `StaffAdvances.tsx`, `StaffCoverage.tsx` inherit the filtering through `useSchoolStaff()`; verify any direct route/school queries there get the same treatment.
- No database or RLS changes.
