# Suggest creating the reverse (return) line

## What you will see
1. After you save a line's stations on the map (and it has at least 2 stations), a prompt appears:
   "هل تريد إنشاء خط العودة؟" (Create the return line?) showing the suggested name, e.g. "التجمع - المعادي (عودة)", with buttons إنشاء / لاحقاً.
2. Clicking إنشاء creates a new line with:
   - Same city and empty description, empty name for the employee to write (editable in the prompt before confirming).
   - The same stations in reverse order. "Pickup only" stations become "Dropoff only" and vice versa; "Both" stays "Both".
   - Active status same as the original.
3. The new line appears in the lines list immediately, and its map editor opens so you can review/adjust stations.
4. When adding trips, both lines show in the line picker so you can schedule going and return trips right away.
5. A "إنشاء خط العودة" button is also added to each line's actions in the table, so you can do it later for existing lines.

## Technical details
- `LineMapEditor`: add optional `onSaved(stations)` callback, called after a successful save.
- `DailyLinesAdmin.tsx` LinesTab: reverse-line confirm dialog (name input), mutation inserting into `daily_lines` then bulk-inserting reversed `daily_line_stations` (order re-indexed, type swapped); invalidate `dla-lines` and the trips' line list query; open map editor on the new line.
- Row action button reads stations of the selected line and opens the same dialog.
- No database changes needed.
