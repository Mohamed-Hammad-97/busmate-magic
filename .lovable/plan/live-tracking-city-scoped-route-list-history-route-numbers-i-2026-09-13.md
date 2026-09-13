# Live Tracking: city-scoped route list & history, route numbers in card headers

## What changes

1. **City scoping for both tabs**  
   The `routes` list that feeds the **Routes List** and **سجل الرحلات** selector already re-fetches when the global city selector changes. Keep that behavior and ensure the `schools.city` filter is applied consistently so both tabs show only the selected city's routes.

2. **Show route number beside route name in card headers**  
   - In **Routes List** cards, change the `CardTitle` from only `{route.name}` to `{route.route_number ?? '-'} - {route.name}` (styled so the number is muted/small if needed).  
   - In **سجل الرحلات** route-selector cards, show the same `route_number - name` pattern.  
   - Pass the route number into `TripHistory` so the opened history header also reads `#<number> - <name>`.

3. **Preserve existing behavior**  
   - Keep the live map tab and its recent improvements untouched.  
   - Keep the non-`!inner` school relation so lines without a linked school record still appear.  
   - Continue sorting by `route_number` ascending.

## Verification

- Change city selector; confirm Routes List and سجل الرحلات selector both refresh to that city's routes.  
- Confirm every card in Routes List shows the line number before the line name.  
- Open a route's trip history and confirm the history header shows `#<number> - <name>`.  
- Confirm active-trip badge, student counts, driver/supervisor details remain unchanged.  
- Confirm build is error-free.
