# Support chat message dates and line-group headers

## Changes

1. **Show date beside every message time**
   - Update message timestamps in Support Chat to include both the calendar date and time, for example `24/09/2026 02:49 PM`.
   - Apply the same display to both current conversations and legacy support conversations shown on this page.

2. **Show the line number and line name in group headers**
   - For line-group conversations, resolve the linked line from the conversation's `route_id`.
   - Display the open chat header as `#<line number> - <line name>`.
   - Keep the existing title as a fallback if the linked line is unavailable or has no number.
   - Leave private staff and customer conversation headers unchanged.

3. **Verify the result**
   - Open a line group in Support Chat and confirm its header contains the correct line number and name.
   - Confirm messages show both date and time without overflowing on phone and desktop views.

## Technical details

- The existing Support Chat page already loads active lines with `id`, `name`, and `route_number`, while each group conversation contains `route_id`; no database change is required.
- The message bubble renderer is shared by current and legacy conversations on this page, so the timestamp update can be applied consistently in one place.
