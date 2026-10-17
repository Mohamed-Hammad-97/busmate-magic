# Flexible route drawing in the line map editor

## What the employee gets
In the line's stations/route map editor:
- **Drag the blue route line** to stretch it onto the road you want. Dragging any part of the line drops a small "shaping point" there, and the route is redrawn along real roads through it.
- **Shaping points** show as small white dots (not numbered, not stations). Drag a dot to move it; click a dot to remove it.
- **"وضع الرسم الحر" (Free draw) toggle:** when on, the line follows the shaping points as straight segments instead of roads — useful for private roads or compounds the map does not know.
- **"إعادة ضبط المسار" (Reset route)** button removes all shaping points and returns to the automatic route.
- Station markers stay draggable as today.
- Saving the line saves the stations **and** the drawn route together.

## Where the drawn route appears
The same custom route is shown everywhere the line is drawn: the admin preview, the parent/booking line view, and live tracking maps. Lines without shaping points keep working exactly as now.

## Return line
When the "create return line" prompt copies a line, the shaping points are copied in reverse order too.

## Technical details
- Migration: add nullable `route_waypoints jsonb` (array of `{lat,lng,after_station_order}`) and `route_mode text default 'road'` (`road` | `free`) to `daily_lines`. Additive, no breaking change; regenerate types.
- `LineMapEditor.tsx`: load/save these fields; make the `Polyline` editable-by-drag (on `mousedown` on the line, find the nearest segment, insert a waypoint between the surrounding stations, drag updates it); render waypoint markers; toggle + reset buttons.
- `googleRoutes.ts`: `computeDrivingRoute(stops, waypoints?)` passes shaping points as `via` intermediates (no stop) to the Routes API; in `free` mode build the path directly from stations + waypoints.
- `LineRoutePreviewMap.tsx` and other daily-line map views accept and pass the line's waypoints/mode.
- Return-line creation in `DailyLinesAdmin.tsx` copies waypoints reversed and `route_mode`.
