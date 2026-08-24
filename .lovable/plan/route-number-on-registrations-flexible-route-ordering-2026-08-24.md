# Route number on registrations + flexible route ordering

## 1. Show route number on registration cards

In the Registrations tab, each student row will show only the number of the route it belongs to (e.g. "خط 3" / "Route 3"), next to the school name — no route name. Students not assigned to any route show a subtle "غير معين / Unassigned" marker.

Data: one extra query loading `route_assignments` joined with `routes (route_number)`, mapped by `registration_id`, so the existing registrations query stays unchanged. The same mapping is used in both Active and Archive tabs.

## 2. Reorder students inside a route

In the Routes tab, "Manage Route" dialog (current students list) becomes an ordered, editable list:

- Drag and drop each student to any position; order numbers renumber automatically 1..N.
- Up/Down arrow buttons as an accessible fallback (and for touch/RTL reliability).
- Changes are staged locally; a "Save order" button writes the new `pickup_order` values in one batch. A "Reset" button discards unsaved changes.
- Newly added students keep appending at the end, as today.

## 3. Suggested optimal order

A "Suggest best order" button computes a recommended pickup sequence from the students' pickup coordinates and the school location:

- Algorithm: start from the student furthest from the school, then nearest-neighbour chaining toward the school — the same logic already used by the AI route planner, run client-side for instant feedback.
- The suggestion is shown as a preview next to the current order (each row shows current position -> suggested position), plus estimated total distance for current vs suggested.
- Employee chooses "Apply suggestion" (loads it into the editable list, still requires Save) or "Dismiss". Nothing is written until the employee saves.
- Students without pickup coordinates are kept at the end of the suggestion and flagged.

## Technical notes

- Files: `src/pages/Registrations.tsx` (route badge + lookup query), `src/components/routes/ManageRouteAssignmentsDialog.tsx` (reorder UI, suggestion engine, batch save).
- Drag and drop via `@dnd-kit/core` + `@dnd-kit/sortable` (new dependency), RTL-aware.
- Distance helper (haversine) and nearest-neighbour ordering added to a small shared util so it matches the edge function behaviour.
- Batch save updates `route_assignments.pickup_order` per row, then invalidates the route/assignment queries so the route map, roster dialog and driver views reflect the new order.
- No database schema changes needed.
