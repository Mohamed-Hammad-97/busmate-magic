# Daily Lines: working delete + Active/Inactive filter

## Why delete fails today
A line that has trips cannot be deleted — the database blocks it because trips point to the line (restrict rule). The error shows briefly and the line stays.

## What changes
1. **Delete works for every line (super admin only, as now)**
   - Confirmation dialog warns (Arabic/English) that the line's stations, trips and their bookings will also be removed.
   - Deleting removes the line and everything under it, then the row disappears from the list immediately.
2. **Active / Inactive filter** above the lines table: "الكل / نشط / متوقف" (All / Active / Inactive), default All, with a count on each option.
3. **Quick toggle**: a switch in the Status column to turn a line active/inactive directly, without opening the edit window.

## Technical details
- Migration: change `daily_line_trips_line_id_fkey` to `ON DELETE CASCADE` (stations already cascade; bookings already cascade from trips).
- `DailyLinesAdmin.tsx` LinesTab: filter state + segmented buttons; optimistic removal in `remove` mutation and invalidate `dla-lines` and trips queries; inline `Switch` updating `is_active`.
