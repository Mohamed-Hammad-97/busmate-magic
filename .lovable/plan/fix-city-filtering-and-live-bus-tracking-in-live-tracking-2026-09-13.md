# Fix city filtering and live bus tracking in Live Tracking

## What's wrong

City names are stored with capital letters in English ("Alexandria", "Giza"), but the city picker sends lowercase keys ("alexandria", "giza"). The Live Tracking page compares them literally, so:

- The Routes List and Trip History show nothing (or everything) when a city is picked.
- The bus map filters out every live bus for the same reason, so the map looks empty even though a trip is running right now with a live position.

Other pages (like the Routes page) already use a small city-name matcher that handles English and Arabic spellings; Live Tracking does not.

## What will change

1. Add one shared city matcher used across the tracking screens, covering the English and Arabic spellings of Cairo, Giza and Alexandria (the same list the Routes page already uses).
2. Routes List and Trip History: load the active lines, then keep only those whose school is in the selected city, using that matcher. "All cities" keeps everything, and lines without a school still appear.
3. Bus map: apply the same matcher to the live buses instead of the exact text comparison, so buses in the selected city show up and the map zooms to fit them.
4. Re-check the map after the fix: a running trip with a live position must appear as a moving bus marker, and clicking it must zoom in and show its details.

## Technical notes

- New helper `src/lib/cityMatch.ts` exporting `matchesCity(cityValue: string | null | undefined, selected: string): boolean`, with the mapping `cairo | giza | alexandria` to their English/Arabic variants, case-insensitive `includes` matching, and `true` for `all`.
- `src/pages/LiveTracking.tsx`: drop `query.eq("schools.city", selectedCity)` (a filter on a non-inner embedded relation does not filter parent rows anyway) and filter the fetched `routes` client-side with `matchesCity(route.schools?.city, selectedCity)`. Keep the `schools (name, city)` relation without `!inner` and the `route_number` ordering.
- `src/components/tracking/OperationsMapView.tsx`: replace `t.routes?.schools?.city === selectedCity` with `matchesCity(...)`. Keep the existing 15s polling, realtime `live_trips` subscription, bounds fitting and selected-bus zoom.
- No database or edge function changes.
