# Restore line list and trip history

## Changes

- Restore the original data query for **قائمة المسارات** so every active line appears again, including lines without a linked school record.
- Restore the original line cards in **قائمة المسارات** without the newly added line-number formatting.
- Restore the original line selection cards in **سجل الرحلات**, keeping each line’s completed-trip history, date filter, and trip details unchanged.
- Keep the requested improvements only inside the live bus map: live updates, showing all working buses, selecting a bus, and displaying its line number and name.

## Verification

- Confirm all three tabs remain visible: bus map, line list, and trip history.
- Confirm the line list and history selector show all active lines as before.
- Open a line from trip history and confirm its completed trips and details load.
- Check the page on mobile and desktop and confirm the current build remains error-free.

## Technical details

- Revert the recent `schools!inner` relation in the tracking-page line query to the previous non-filtering school relation.
- Remove only the recent route-number display additions from the line-list and history-selection cards; do not undo the map work.
