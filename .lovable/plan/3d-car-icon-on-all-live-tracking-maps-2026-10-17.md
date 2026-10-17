# 3D car icon on all live tracking maps

## What you get
The green circle bus icon is replaced with a 3D white car, like the one in your Google Maps screenshot, on every live tracking map:
- Staff: the bus map in Live Tracking and the daily lines live map
- Parents/customers: the tracking tab and the daily-line trip tracking page
- Drivers/supervisors: their trip screen map
- Company portal: the live tracking map

The car turns to face the direction the bus is driving, worked out from its last two positions. When the bus is parked or we don't know the direction yet, it faces the last known way.

Buses with no GPS signal (the faded ones at the school) keep a faded version of the same car, and the selected bus gets a small colored ring so you can still spot it.

## About the image
Google's own navigation car can't be copied out of Google Maps — it isn't available for reuse and would be a copyright problem. I'll generate a matching 3D white car seen from above (transparent background) and use it everywhere.

## Technical details
- Generate `src/assets/car-3d.png` (transparent, top-down, nose pointing up).
- New shared helper `src/lib/carMarker.ts`: rotates the car to a heading on a canvas and returns a cached data URL (rounded to 10° steps), plus `computeHeading(prev, next)` using `google.maps.geometry.spherical.computeHeading` with a plain-math fallback; ignores moves under ~5 m.
- Replace bus marker icons in `LiveTripMap.tsx` (parent + driver views), `OperationsMapView.tsx`, `CompanyLiveTracking.tsx`, `DailyLinesLiveMap.tsx` and `DailyLineTripTracking.tsx`; keep a per-trip ref of the previous position to compute heading.
- Marker anchored at the image center, size ~56 px; no database changes.
