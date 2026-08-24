# Add dedicated Line column to registration records

## Goal
Show each registration's assigned route/line number as a standalone column in the Registrations tab summary table, styled as a blue circular badge (e.g. "# 26"), matching the attached screenshot.

## Current state
- `src/pages/Registrations.tsx` already fetches `routeNumberByRegistration` from `route_assignments` joined with `routes.route_number`.
- The route number is currently rendered underneath the School cell as a small pill, not as its own column.
- The summary table columns are: Student, Parent, School, Pickup Address, Grade, Type, Status, Date, Actions.

## Changes

1. **Add a LINE column to the registrations table**
   - Insert a new `<TableHead>` between School and Pickup Address (or after School) labeled "Line" / "الخط".
   - Add a matching `<TableCell>` in each row that renders:
     - If a route number exists: a circular/rounded primary badge showing `# {routeNumberByRegistration[reg.id]}`.
     - If unassigned: a subtle muted text label "Unassigned" / "غير معين".
   - Remove the existing route-number pill from the School cell so the School column only shows the school name.

2. **Style the badge to match the screenshot**
   - Use a compact circular or pill-shaped badge with primary background/foreground colors.
   - Keep it RTL-aware (text direction and column order already handled by the table).

3. **No data changes**
   - Reuse the existing `routeNumberByRegistration` query and mapping.
   - No backend or schema changes required.

## Files
- `src/pages/Registrations.tsx`
