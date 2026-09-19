# Active buses list on the tracking map

## What you get

On the bus map in Live Tracking, the "X باص على الخريطة" counter becomes a button. Clicking it opens a side panel listing every line currently running:

- Line number and name (e.g. `#55 - المعادي`)
- School name
- Supervisor name and phone (driver name shown too)
- When the trip started ("منذ 25 دقيقة")
- A small tag when the bus has no GPS signal yet

Clicking a line in the list selects that bus, zooms the map to it and opens its details card. The panel closes with an X, and it also opens from the "بدون إشارة" counter with the no-signal lines shown at the top.

The list follows the city you picked at the top, refreshes with the map every 15 seconds, and is scrollable.

## Who sees it

Live Tracking is already open to all staff — operations, customer service and super admins — so they all get the list with no permission changes needed.

## Technical details

- All changes are in `src/components/tracking/OperationsMapView.tsx`; no database, RLS or query changes.
- New `showTripList` state. The existing counter chips in the header become buttons toggling it; the no-signal chip opens the same panel scrolled to the no-signal group.
- Panel: `Card` + `ScrollArea`, positioned `absolute top-16 left-4` (RTL-aware), max height `calc(100% - 6rem)`, rendered above the map.
- List source: the already-filtered `activeTrips` (city-filtered), sorted with `tripsWithLocation` first and `staleTrips` after, reusing `routeLabel()`, `isStale()` and `formatDistanceToNowStrict` with the `ar` locale.
- Row click calls the existing `setSelectedTrip` / marker-selection path so the current zoom-to-bus behaviour is reused; panel stays open on mobile widths but collapses to full width under `sm`.
