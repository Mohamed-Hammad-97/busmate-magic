# Let customer service create line group chats

## What I checked

- Customer service staff do have the Support Chat page, and the "Group" button is shown to everyone on that page.
- The database rules allow any staff member to create a conversation and add its members, and all 11 customer-service accounts are correctly registered as staff.
- One real gap found: reading driver/supervisor login records is limited to the Operations department. When a customer service employee creates a group, the supervisor lookup returns nothing, so the supervisor is silently left out of the group.
- The "create group" step ignores every error it gets back and shows no message, which matches exactly what you described: you pick a line, press create, and nothing happens with no explanation.

The exact reason the creation stops is not yet confirmed — the code throws away the error text. The first step below surfaces it, and the rest of the plan removes the known blockers.

## The fix

1. **Stop hiding errors.** The group creation, staff chat and customer chat actions will check what the database returned and show a clear message on failure, plus a success confirmation and an immediate refresh of the chat list.

2. **Create the group through a secure server step.** Instead of the browser doing the supervisor lookup and member insert (which customer service is not allowed to do fully), one server action will: create the line group, add the creator, add the line's supervisor, and add every parent on that line. Customer service, operations and admins can all call it; it checks the caller is a staff member.

3. **Supervisor always included.** Because the server step runs with full rights, the supervisor of the line is added to the group no matter which department created it.

4. **Keep lines with an existing group hidden**, as you asked. If the list is empty the button stays disabled with a short note saying every line already has a group, so it never looks broken.

## Technical details

- New edge function `create-route-group-chat` (`verify_jwt = false`, validates the JWT in code via `getClaims`, confirms the caller has a row in `employees`/`user_roles`): inserts into `unified_conversations` (`type: 'route_group'`, `route_id`, `subject`, `allow_customer_messages: false`, `created_by`), then inserts `conversation_participants` for the employee, the route's supervisor (via `driver_accounts`), and each parent from `route_assignments -> registrations -> parent_accounts` with `can_send: false`. Uses the service role, so the `driver_accounts` Operations-only SELECT policy no longer blocks customer service. Returns the conversation id, or the existing one if the route already has a group (idempotent).
- `src/pages/SupportChat.tsx`: `createGroupChat` calls `supabase.functions.invoke("create-route-group-chat", { body: { routeId } })`; add `onError` toasts to `createGroupChat`, `createStaffChat` and `createCustomerChat`, capture and check the `error` returned by each `.insert(...)`, and invalidate `all-unified-conversations` on success.
- No schema or RLS change required; existing policies already permit the reads the UI needs after the member insert moves server-side.
- Verification: sign in as a customer-service-only account (e.g. Sara / Mohamed), create a group for a line, confirm the conversation appears in the Groups filter, the supervisor and parents are listed as members, and a deliberate failure (a line that already has a group) shows a readable message instead of silence.
