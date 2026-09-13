# Why the active trip doesn't show on the bus map

## What I found

There is exactly one trip marked "in progress" in the system:

- Line **#7 ابراهميه** (Alexandria)
- Started **7 September at 19:03** — six days ago
- It has **no location at all** (no latitude/longitude ever recorded)

So the map is behaving correctly: it counts the trip as active, but it has no point to draw. Two separate issues are behind it:

1. **The trip was never ended.** The driver started it and the app closed without finishing it, so it stays "in progress" forever and keeps inflating the Active Trips counter.
2. **No GPS point was ever saved.** The bus position is only written while the driver keeps the trip screen open with location permission granted. If the driver denies permission, closes the app, or the phone blocks background location, nothing is stored and no bus appears.

## What to change

1. **Stale trip cleanup (operations side)**
   - On the Bus Map, list active trips that have no position, showing line number, name, driver and how long ago they started.
   - Each stale entry gets an "End trip" action so operations can close trips left open (also handled for any trip with no location update for several hours).
   - The "waiting for GPS" overlay becomes this list instead of a blank message, so it is obvious which line is stuck and why.

2. **Make it clear on the map when a bus has no signal**
   - Show the count of live buses and the count of "no signal" buses as separate chips.
   - For a trip with no position, show a faded marker at its school location labelled "بانتظار إشارة GPS", so the trip is visible on the map rather than invisible.

3. **Driver-side reliability**
   - Show a clear warning banner in the driver trip screen when location permission is denied or tracking stopped, with a retry button, so the driver knows their bus is not visible.
   - Keep the trip's last location timestamp updated so operations can see the age of the signal.

4. **Close the current stuck trip** for line #7 as part of this work.

## Technical notes

- `src/components/tracking/OperationsMapView.tsx`: replace the "waiting for GPS" overlay with a stale-trip panel built from `activeTrips.filter(t => !t.current_latitude)`; add faded school-location markers; add an end-trip mutation setting `status = 'completed'` and `ended_at = now()` on `live_trips`, invalidating `all-active-trips`.
- Use `last_location_update` to render signal age; treat a trip as stale when it has no position or no update for over 3 hours.
- `src/components/tracking/DriverTripInterface.tsx` / `src/hooks/useGeolocation.ts`: surface `geoError` and `isTracking` in a banner with a "تشغيل تتبع الموقع" retry that calls `startTracking` again.
- One-off data fix: mark the September 7 `live_trips` row for route `eaddbcdb-…` as completed.
- No schema changes.
