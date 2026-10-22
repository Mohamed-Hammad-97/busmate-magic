# Daily Lines admin: filter trips by date

## What you'll see (Trips tab)
- A row of day buttons at the top: **All / الكل**, **Today / اليوم**, **Tomorrow / غداً**, then the next days of the week (e.g. Sat, Sun, Mon...) with their dates.
- A **date picker** ("Choose date / اختر تاريخ") to jump to any specific date, past or future.
- Tapping a day or picking a date shows only that day's trips, sorted by departure time, with a count of trips.
- **All** shows every trip grouped under date headers (newest dates first), so the list is organised by date.
- Today is selected by default when opening the tab.

## Technical details
- `TripsTab` in `src/pages/DailyLinesAdmin.tsx`: add `selectedDate` state (`"all"` or `YYYY-MM-DD`, default Cairo today).
- When a date is selected, query `daily_line_trips` with `.eq("trip_date", date)` ordered by `departure_time` (query key includes the date), so older trips beyond the current 200 limit are reachable. "All" keeps the existing query.
- Day buttons: today + next 6 days, computed in Cairo time; date picker uses the existing shadcn Popover + Calendar.
- Table rows grouped by `trip_date` with header rows in "All" mode; existing actions (edit, cancel, reopen, delete) unchanged.
