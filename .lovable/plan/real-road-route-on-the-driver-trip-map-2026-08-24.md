# Real road route on the driver trip map

The driver/supervisor trip map currently draws a straight polyline connecting pickup points and the school in order (`src/components/tracking/LiveTripMap.tsx` builds the path directly from coordinates). The project already has a road-routing helper, `computeDrivingRoute` in `src/lib/googleRoutes.ts`, used by the daily-lines maps. This plan applies it to the school trip map.

## What changes

- The trip line follows real streets (turns, one-ways) instead of a straight line between stops.
- The route is computed through the ordered stops: driver's current position (when available) → pickup points in pickup order → school.
- Absent students are skipped so the route does not detour to them.
- While the route is being computed, the current straight line is shown as a placeholder; if Google routing is unavailable it stays as the straight-line fallback (already handled inside the helper).
- A "Navigate" action opens turn-by-turn navigation in Google Maps for the driver: full-trip navigation from the map header, and per-stop navigation to the next pickup.

## Technical notes

- In `LiveTripMap.tsx`, keep the ordered stop list as the memo it is today, then add an effect that calls `computeDrivingRoute(stops)` and stores the decoded path in state used by `<Polyline>`.
- Recompute only when the ordered stop list actually changes (compare a joined key of rounded coordinates), not on every driver GPS tick, to avoid hammering the routing API. Include the driver origin by re-computing at most every ~30s or when the next pending stop changes.
- Keep the existing arrow symbols/styling on the polyline; smooth the stroke since the path now has many points.
- Navigation deep link: `https://www.google.com/maps/dir/?api=1&origin=...&destination=<school>&waypoints=<pickups joined by |>&travelmode=driving` (Google caps waypoints — cap at the first 9 pending stops and route to the school last). Per-stop button uses a simple `destination=lat,lng` link.
- Apply the same road-following path to `ParentLiveTracking.tsx` if it renders the same straight polyline, so parents see the same route.
- No database changes.
