# AI Routes — Expanded Flows

Restructure the AI Routes page into **three tabs** and add editing everywhere a suggested/created route appears.

## Tabs

```text
[ Draw Area ]   [ Auto Areas ]   [ Unassigned ]
```

### 1. Draw Area (current flow, kept as-is)
Employee draws a polygon and generates suggestions inside it. Existing behavior preserved.

### 2. Auto Areas (new)
- Employee picks City + School + Car Type + Max Seats.
- Backend clusters unassigned pickups (k-means-style grouping already in `ai-route-planner`) with **no polygon**, and returns candidate **areas** — each area = one suggested line + a bounding polygon derived from its students.
- UI shows each suggested area on the map (colored polygon + numbered pickups) with an **Approve** / **Reject** control.
- Approving creates the route; rejecting drops it from the list.

### 3. Unassigned (new)
- Employee picks City + School.
- Lists all active registrations for that school that are NOT in any `route_assignments`.
- Shows them as cards + on a map with the school pin.
- For each registration (or multi-select), employee picks an **existing route** (of the same school, with available seats) from a dropdown and clicks **Add to route** → creates a `route_assignments` row with next `pickup_order`.

## Editing suggested lines (before creating)
On every suggestion card (Draw Area + Auto Areas):
- Each student row gets a small **remove (x)** button → removes them locally from that suggestion.
- An **"Add student"** button opens a picker of currently-unassigned registrations for the school (excluding students already in other suggestions in this batch) → adds them to this suggestion.
- Distance/pickup_order recomputed client-side (simple nearest-neighbor from school).
- "Create Route" then uses the edited list.

## Editing already-created lines (after creating)
Add a compact **"Manage line"** dialog reachable from the Unassigned tab's route dropdown (and from `Routes` page later — out of scope now):
- Lists current assignments with remove buttons (delete from `route_assignments`).
- Add-student picker (same unassigned-students query).
Reuses the same component used in Unassigned tab.

## Technical details

**Frontend**
- `src/pages/AIRoutes.tsx`: wrap existing content in `<Tabs>` with three panels. Extract current flow into `DrawAreaTab`, add `AutoAreasTab` and `UnassignedTab` components under `src/components/routes/`.
- New shared hook `useUnassignedRegistrations(schoolId)` returning active registrations not in `route_assignments` (query with `.not('id','in', <ids>)` or a left join via view — simplest: fetch registrations for school then filter out ids present in `route_assignments`).
- New `SuggestionEditor` component wrapping current suggestion card with add/remove controls.
- New `ManageRouteAssignmentsDialog` for post-creation edits (remove + add rows in `route_assignments`, next pickup_order = max+1).

**Backend / edge function** (`supabase/functions/ai-route-planner/index.ts`)
- New action `suggest-areas`: same clustering as `suggest-routes` but returns each cluster's convex-hull polygon alongside students. If clustering already exists without polygon input, reuse it and just append the polygon (compute from student lat/lng — Andrew's monotone chain).
- Existing `create-suggested-route` already accepts an arbitrary student list — reused unchanged for edited suggestions.

**Database**
- No schema changes required. `route_assignments` already supports insert/delete with existing RLS for employees/super admins.

## Out of scope
- Modifying the `Routes` page itself (management dialog is reachable only from the new tab for now).
- Persisting rejected auto-area suggestions.
