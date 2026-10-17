# Customer live trip: my segment only, bus zoom, stop request, and station ETAs

## 1. Show only the customer's part of the line
- On the customer's live trip map, draw the route only from their pickup station to their drop-off station, following the same road (or hand-drawn) route the line uses.
- Other stations are hidden. Only the bus, the pickup station and the drop-off station show.
- The existing "محطتي فقط" switch stays as a way to go back to the full line view.

## 2. Tap the bus to zoom to it
- Tapping the bus centers the map on it at street-overview level (close enough to see nearby streets, not too close), and turns "follow bus" back on.

## 3. "طلب الوقوف / Request stop" button
- After the customer has boarded (and before drop-off), a big "اطلب الوقوف للنزول" button appears on their trip screen. It can be pressed once, with a short cooldown, and shows "تم إرسال الطلب" afterward.
- On the driver/supervisor trip screen, a bold red alert appears at the top immediately, with a sound/vibration:
  "الرجاء الانتباه يوجد تنبيه من عميل بطلب الوقوف للنزول الان" plus the passenger's name, boarding code and drop-off station.
- The alert has a "تم النزول" button that marks the passenger as dropped off (same as the existing drop-off action) and clears the alert. A "إغلاق" option dismisses it without marking.

## 4. Estimated times for every station (Google)
- When staff set a trip's departure time (time at the first station), the app calculates the expected arrival time at each following station using Google's driving times along the line's route.
- Times are calculated once per line and saved, so they are reused for every trip and don't add cost on each booking. They are recalculated whenever the line's stations or route are saved.
- Booking page: after choosing a trip and stations, the customer sees "موعد الركوب المتوقع" and "موعد الوصول المتوقع", e.g. departure 17:00 + 12 min = 17:12.
- Shown also in: the customer's upcoming trips and trip tracking page, and next to each station in the driver's trip screen.
- Labeled as estimates. Lines saved in free-draw mode use Google's driving time between stations where possible, otherwise an estimate from distance.

## Technical details
- DB migration: `daily_line_stations.minutes_from_start int` (nullable); `daily_line_bookings.stop_requested_at timestamptz`; customer may update only `stop_requested_at` on their own boarded, not-dropped booking (extend `parent_booking_update_is_safe` guard / trigger). Realtime enabled on `daily_line_bookings` for the driver screen.
- New edge function `daily-line-compute-eta` (staff-only): reads line stations + waypoints, calls Google Routes `computeRoutes` via the Google Maps connector gateway (traffic-unaware, one call with intermediates), stores cumulative leg durations into `minutes_from_start`. Called from `LineMapEditor` save and return-line creation. Requires linking the Google Maps connector (connect card shown during build).
- `src/lib/stationEta.ts`: `etaFor(departure_time, minutes_from_start)` helper + small test.
- `LineRoutePreviewMap.tsx`: new `segment={fromId,toId}` prop slicing `routePath` between nearest points to the two stations; driver marker `onClick` → pan + `setZoom(15)` + follow.
- `DailyLineTripTracking.tsx`: segment mode by default, stop-request button.
- `DriverDailyLineTrips.tsx`: realtime listener on `stop_requested_at`, red alert banner with drop-off action (clears `stop_requested_at`).
- `RegisterDailyLine.tsx` / customer portal trip cards: show ETAs.
