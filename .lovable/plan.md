# Show full line details in the customer portal Routes tab

## The cause

The line does have a driver and supervisor assigned. The portal cannot read them: parents are allowed to see their line and their assignment, but the access rules on the drivers and supervisors tables have no entry for parents (only employees, drivers/supervisors themselves, and daily-line passengers). So the joined driver/supervisor comes back empty and the card falls back to "no staff assigned".

## What changes

1. Access rules: allow a parent to read exactly the driver and the supervisor assigned to a line one of their children is on — nothing else. Only name, phone and vehicle info are shown in the portal.
2. Routes tab card shows:
   - Line name (and line number)
   - Driver name + call button
   - Supervisor name + call button
   - Bus type (AC / Non-AC)
   - Bus plate number, plus model/color when available

## Technical notes

- New security-definer function `public.is_parent_line_driver(_user_id, _driver_id)` and `public.is_parent_line_supervisor(_user_id, _supervisor_id)` checking `routes -> route_assignments -> registrations -> parent_accounts` against `get_user_parent_ids(auth.uid())`, plus SELECT policies on `drivers` and `supervisors` using them (avoids recursion).
- `src/pages/ParentDashboard.tsx`: extend the `parent-routes` select to pull `route_number`, `drivers(full_name, phone, vehicle_plate, vehicle_model, vehicle_color)`, `supervisors(full_name, phone)`, and render the new fields in the routes card and in the summary line.
- No schema/table changes.
