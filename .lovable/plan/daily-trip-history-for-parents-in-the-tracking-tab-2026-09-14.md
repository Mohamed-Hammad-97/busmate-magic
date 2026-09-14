# Daily trip history for parents in the Tracking tab

## What the parent will see

Under the live map in the Tracking tab, a new "Trip history" section listing past trips, newest first, grouped by day:

- The date (e.g. Sunday, 14 September)
- For each trip of that day: whether it was the morning ride (to school) or the afternoon ride (to home)
- When the trip started and when it finished
- For each of the parent's children on that trip: the time they were picked up and the time they were dropped off, or a note that no time was recorded

A "Load more" button loads older days. If there is no history yet, a friendly empty message appears.

## How the morning/afternoon label is decided

Trips are not tagged as school-bound or home-bound in the records, so the label comes from the start time in Cairo time: before noon is shown as "To school", from noon onwards as "To home". This matches the current data, where trips cluster in the early morning and the afternoon.

## Behaviour notes

- Shows only trips on the routes the parent's children are assigned to, and only the parent's own children's times.
- The existing live map, the trip details overlay, and the notification bell stay exactly as they are.
- Arabic and English both supported, with correct right-to-left layout and localized dates.
- Works when there is no active trip: the history appears in place of the empty "No active trips" card as well as below an active trip.

## Technical details

- Edit `src/components/tracking/ParentLiveTracking.tsx`; add a new component `src/components/tracking/ParentTripHistory.tsx` rendered below the map card and inside the no-active-trip state.
- Query `live_trips` with `status = 'completed'`, `route_id in (routeIds)`, ordered by `started_at desc`, paginated with `range()` (10 per page), selecting `routes(name, schools(name), drivers(full_name))`.
- Query `trip_student_status` for the loaded trip ids restricted to the parent's `registration_id`s, reading `picked_up_at`, `dropped_off_at`, `status`.
- Existing RLS already allows this: `Parents can view their route trips` on `live_trips` and `Parents can view their children status` on `trip_student_status`. No schema or policy changes.
- Group rows by `started_at` date in Cairo time; format times with `date-fns` and the active locale.
- Add i18n keys under `parentPortal.tripHistory.*` in `src/i18n/index.ts` (EN + AR).

## Verification

- Open the parent portal Tracking tab and confirm past days appear with start/finish times and each child's pickup and drop-off times.
- Check a day with both a morning and an afternoon trip shows both with the right labels.
- Check "Load more", the empty state, Arabic layout, and mobile width.
