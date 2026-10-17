# Microbus icon, better zoom, and "my station only" for customers

## 1. 3D microbus instead of the small car
- Make a new 3D white 14-seat microbus seen from above (like a Toyota HiAce: long body, sliding door, roof windows), with the front pointing up.
- It replaces the car on every tracking map. It still turns to face the way it's driving, the selected bus still gets its ring, and buses with no signal still show faded.
- The microbus is a bit longer than wide, so it looks right next to the streets.

## 2. Live Tracking opens zoomed out to show everything
- When you open the bus map, it zooms out once so every running bus and its school fit on screen with space around the edges. With one bus, it stays zoomed out at street-overview level instead of zooming in close.
- The map stops jumping back every 15 seconds when buses move. Your own zoom and dragging stay put until you pick a bus or tap a new "show all buses" button.
- The daily lines live map works the same way.

## 3. Customer daily-line trip tracking
- **Bus zoom:** when the bus has a signal, the map centers on it at a comfortable zoom where nearby streets are still visible, not too close. It follows the bus as it moves, but stops following once the customer drags the map. A "follow bus" button turns following back on.
- **"محطتي فقط / My station only" switch** on the map: it hides every other station and the route line, leaving only the bus and the customer's own pickup station (plus their drop-off station if they have one). Turning it off shows the full line again. The choice is remembered on that phone.

## Technical details
- Replace `src/assets/car-3d.png` with `src/assets/microbus-3d.png`; `src/lib/carMarker.ts` draws it with a non-square aspect ratio (about 1:2).
- `OperationsMapView.tsx` / `DailyLinesLiveMap.tsx`: fit bounds only once (ref guard) on buses plus school points, padding about 80, `maxZoom` 13 via an idle listener; add a "show all" control that refits.
- `LineRoutePreviewMap.tsx`: new props `focusOnDriver`, `onlyStationIds`, `hideRoute`. When focusing, pan to the driver at zoom 15 (once at zoom, then pan only), and pause following on `dragstart`.
- `DailyLineTripTracking.tsx`: switch state saved to localStorage; passes the pickup/drop-off station ids.
- No database changes.
