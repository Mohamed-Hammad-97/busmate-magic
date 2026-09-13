# Unread Messages Filter in Support Chat

Add an "Unread" filter to the Support & Communications chat so customer service and employees can see only conversations that contain unread messages.

## What changes

In `src/pages/SupportChat.tsx` sidebar:

1. **Unread filter button** — a new chip at the start of the category row (before "All"), labeled "Unread" with a mail icon and the total unread count badge. It shows only when there is at least one unread message.
2. **Click behavior** — clicking it filters the conversation list to only chats with `unread > 0`, across all categories (staff, customers, groups, support). The search box still works within that filtered list.
3. **Toggle off** — clicking the active "Unread" chip again (or any other category) returns to the normal full list.
4. **Empty state** — if "Unread" is active and all messages get read, the list shows a friendly "No unread messages" state.

## Technical notes

- Add a `showUnreadOnly` boolean state; the existing `filteredConversations` filter gains `(!showUnreadOnly || c.unread > 0)`.
- Reuses the existing `unreadMap` counts and realtime invalidation already in the page — no new queries, no schema changes.
- The green per-chat unread badges and bold styling stay as they are.
