# Give customer service access to live bus tracking

## What happens today

Customer service staff can open the Live Tracking page and see the routes list, but:

- The bus map stays empty and "Active Trips" shows 0 — live trip records are readable only by operations staff.
- Trip history for a route shows nothing, for the same reason.
- Driver names on route cards are blank — driver records are also operations-only.

Everything else the page needs (routes, schools, supervisors, student status, trip logs) is already open to all employees, so only two gaps remain.

## The change

Allow every signed-in employee to **view** (read-only):

- Live trips — so the bus map, active-trip count and route history all work for customer service.
- Driver records — so the driver name shows on route cards, the map bus labels and trip history.

Creating, starting, ending or editing trips stays limited to operations staff and drivers/supervisors, exactly as now. Customer service gets look-only access.

City filtering stays as it is: staff see the lines of the city selected at the top of the page.

## Technical details

Two new PERMISSIVE SELECT policies via migration:

- `live_trips`: `CREATE POLICY "Employees can view live trips" ON public.live_trips FOR SELECT USING (public.is_employee(auth.uid()));`
- `drivers`: `CREATE POLICY "Employees can view drivers" ON public.drivers FOR SELECT USING (public.is_employee(auth.uid()));`

No existing policy is dropped or weakened; write policies (`Operations can manage ...`) are untouched. No frontend changes needed — `LiveTracking.tsx`, `OperationsMapView.tsx` and `TripHistory.tsx` already render for any employee once the data is readable.

Verification: query `live_trips` and `drivers` as a customer-service user role to confirm rows return, and confirm the sidebar Live Tracking entry (already ungated) leads to a populated map.
