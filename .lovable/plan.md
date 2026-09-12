# Group chat sync, unread badges, and better live tracking

## What I checked

- Line groups are created once and never updated afterwards: nothing links a line's student list to the group members, so adding or removing a student on a line leaves the group unchanged.
- The Support Chat page is only offered to the customer service department, which is why operations staff don't see the line groups — the data rules already allow operations to read every line group, it's the menu entry that is missing.
- Unread messages are tracked with a single "read" flag per message, shared by everyone. In a group, the first person who opens the chat clears the badge for all other members. There is no per-person read position stored.
- The tracking map shows the line name only, and refreshes every 5 seconds without live updates.

## The changes

### 1. Line groups stay in sync automatically
When a student is added to a line, that student's parent is added to the line's group. When removed (or the subscription is cancelled), the parent is removed — unless another child of theirs is still on the same line. This runs in the database, so it works no matter who makes the change (staff, operations, or automated assignment).

### 2. Operations see all line groups
Support Chat becomes available to operations as well as customer service. Operations staff see all line groups plus their own conversations, and can create a group for any line that doesn't have one yet.

### 3. Real unread counters (1, 2, 3 …) for everyone
Each person gets their own read position per conversation. The chat list shows the number of messages they haven't read, the number clears the moment they open the chat, and a total badge appears on the chat entry. This applies to staff chat, the driver/supervisor portal, and the parent portal alike.

### 4. Better live tracking for employees
- The line number is shown beside the line name everywhere on the tracking screen (map header, bus popup, list).
- The map opens zoomed out to fit every bus that is live right now.
- Clicking a bus zooms in on it and shows a header with its line number and name; closing returns to the full view.
- Bus positions update live instead of waiting for the next refresh, and buses with no GPS signal yet are counted separately so the screen never looks empty by mistake.

## Technical details

- Migration:
  - `ALTER TABLE conversation_participants ADD COLUMN last_read_at timestamptz` (nullable, defaults to null = everything unread).
  - `sync_route_group_participants()` SECURITY DEFINER trigger on `route_assignments` (INSERT/DELETE) and on `registrations` status change to `cancelled`/`archived`: resolves the route's `unified_conversations` row of type `route_group`, inserts a `conversation_participants` row (`participant_type: 'parent'`, `can_send: false`) when missing, deletes it when the parent has no remaining assignment on that route.
  - RPC `mark_conversation_read(_conversation_id uuid)` setting `last_read_at = now()` for the caller's participant row; grants for `authenticated`.
  - Operations already pass `can_read_conversation` for `route_group`; no policy change needed.
- `src/components/layout/Sidebar.tsx`: Support Chat entry becomes `multiDepartment: ["customer_support", "operations"]`.
- Unread counts: replace the global `is_read` aggregation in `SupportChat.tsx`, `ParentChat.tsx`, `DriverChatSection.tsx` (and `CompanyChatView.tsx` where applicable) with a count of `unified_messages` where `created_at > last_read_at` and `sender_id <> auth user`; call `mark_conversation_read` on open and on each new incoming message while open; keep the existing realtime invalidation so badges update instantly.
- `src/components/tracking/OperationsMapView.tsx`: add `route_number` to the `live_trips -> routes` select, render `#{route_number} {name}` in the marker info window, selected-trip header and student panel; keep `fitBounds` when nothing is selected, re-fit on deselect, `panTo` + `setZoom(15)` on select; add a realtime subscription on `live_trips` UPDATE (cleaned up on unmount) alongside a slower polling fallback; guard against missing coordinates.
- `src/pages/LiveTracking.tsx`: show `#route_number` in the routes list and history cards.
- Verification: assign/unassign a student on a line with a group and confirm the parent appears/disappears in members; open a group as two different staff accounts and confirm badges are independent; confirm the tracking map fits all live buses and zooms on click.
