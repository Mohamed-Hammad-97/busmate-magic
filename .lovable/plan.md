# WhatsApp-style Messages for the Customer Portal

Rebuild the parent "Messages" tab into a real chat picker (support / supervisor / line group) and tighten who can read chats so private conversations stay private.

## What the parent gets

A "New chat" button opens a picker with up to three destinations:

1. **خدمة العملاء (Customer Service)** — one support conversation per parent, reused if it already exists.
2. **المشرف (Supervisor)** — private 1:1 with the supervisor of the line their child rides. Auto-resolved from the child's route assignment; if children ride different lines, each supervisor is listed with the child + line number.
3. **جروب الخط (Line group)** — appears only if a group chat exists for their line and the parent was added to it. The message box is enabled only when the group is opened to customers; otherwise the parent sees a read-only notice.

Chat itself stays as it is today (bubbles, unread badges, realtime updates, mobile back button) but gains contact avatars/names instead of a free-text "subject", and a locked composer state for read-only groups.

## Who can read what

Current state: any Customer Support or Operations employee can read **every** conversation and message, including parent↔supervisor private chats. New rules:

| Role | Can read |
| --- | --- |
| Super admin | Every conversation and message |
| Customer Support | Customer-support chats + line group chats. **Not** parent↔supervisor private chats |
| Operations | Line group chats + their own chats with supervisors/drivers |
| Supervisor / driver | Only conversations they are a participant in |
| Parent | Only their own conversations |

Everyone can always read conversations they participate in.

## Technical notes

- New conversation type value `customer_support` reserved for the parent↔CS channel (keeps `customer_supervisor` strictly private). Existing rows keep their current type; the CS read rule also covers legacy `customer_dm` and the old `chat_conversations` table.
- New SECURITY DEFINER helpers to avoid RLS recursion:
  - `public.conversation_type_of(_conversation_id uuid) returns conversation_type`
  - `public.can_read_conversation(_user_id uuid, _conversation_id uuid) returns boolean` implementing the table above (super_admin → true; CS → support + route_group; operations → route_group; else participant check).
- Replace the blanket `CS and Ops employees can view all conversations` / `... all messages` / `... all participants` policies on `unified_conversations`, `unified_messages`, `conversation_participants` with policies using `can_read_conversation`. Insert policy on `unified_messages` keeps requiring `can_send_in_conversation` + `sender_id = auth.uid()`, so read access never implies write access.
- Same super-admin-only override added to `chat_conversations` / `chat_messages` for the legacy support thread.
- New `supabase/functions/parent-start-conversation` edge function (service role, JWT verified in code) so a parent can open a support or supervisor chat: it resolves the target supervisor from the parent's route assignments, reuses an existing conversation, and inserts both participants with correct `can_send`. This avoids widening client-side insert policies on `conversation_participants`.
- `src/components/chat/ParentChat.tsx`: replace the "New Conversation / subject" screen with the destination picker, call the edge function, label rows by contact type, and disable the composer when the parent's participant row has `can_send = false`.
- `src/pages/SupportChat.tsx`: no query change needed — RLS narrows the list automatically; add a small "visible to super admin only" hint on private supervisor threads when the viewer is a super admin.

## Verification

- Sign in as a parent with a completed registration: start each of the three chat types, send and receive a message.
- Confirm a CS employee's chat list no longer contains parent↔supervisor threads, while super admin still sees them.
