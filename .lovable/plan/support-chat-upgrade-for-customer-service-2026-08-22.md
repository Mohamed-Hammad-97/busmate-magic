# Support Chat Upgrade for Customer Service

Improve the Support & Communications page so CS employees can start chats faster, find customers easily, and never miss a new message.

## 1. Start chat with staff — add Employees

The staff picker today lists only drivers and supervisors. It will become a searchable dialog with three tabs:

- **Employees** (internal staff: name, email, departments, city)
- **Supervisors** (name, phone)
- **Drivers** (name, phone)

A search box filters by name or phone across the active tab. Clicking a person opens the existing DM (or creates a new `staff_dm` conversation with both participants).

## 2. Start chat with customer — large, searchable picker

Replace the small customer dialog with a wide dialog (large modal, scrollable table-style list) showing per customer:

- Parent name
- Phone (father phone, and payment/mother phone when present)
- City
- Children/student names (from their registrations)

Controls:
- **City filter** dropdown, defaulting to the employee's currently selected city context; employees only see customers in the cities assigned to them.
- **Search bar** matching parent name, any phone number, or a student name.

Clicking a row opens/creates the customer DM as it does today.

## 3. Group chats

No change in behaviour — the existing route group creation and the "Customer Messages" toggle stay exactly as they are.

## 4. Unread messages: notifications, badges, colors

- Each conversation in the sidebar gets an **unread count badge** (green pill) computed from messages not sent by the current user with `is_read = false`.
- Unread rows are styled distinctly: bold name, stronger background; already-read rows use the normal muted style.
- Categories chips show a total unread count.
- Opening a conversation marks its incoming messages as read, clearing the badge.
- A **global realtime listener** on new messages fires a toast pop-up ("New message from X") whenever a message arrives in a conversation the employee participates in and is not currently viewing. Clicking the toast opens that chat.
- Conversation list refreshes in realtime so new chats appear without reload.

## Technical notes

- All changes are in `src/pages/SupportChat.tsx`, plus a small new component for the customer picker (`src/components/chat/CustomerPickerDialog.tsx`) and a staff picker (`src/components/chat/StaffPickerDialog.tsx`) to keep the page readable.
- Customer data query joins `parent_accounts` → `registrations(student_name, status)` and filters by `city` using the existing `useCity` context / `employee.cities`.
- Employee DM targets come from `employees` (`user_id`, `full_name`, `email`, `departments`), excluding the current user.
- Unread counts: a grouped query over `unified_messages` (and `chat_messages` for legacy threads) for `is_read = false` and `sender_id <> current user`, keyed by `conversation_id`. Marking read = `update is_read = true` on the open conversation's incoming messages.
- Global realtime: one Supabase channel subscribing to `INSERT` on `unified_messages` and `chat_messages`, filtered client-side to conversations visible to the employee; uses the existing toast system.
- No schema changes required — `is_read` already exists on both message tables. If RLS blocks employees from updating `is_read` on messages they received, a narrow update policy will be added for that column path only.
