Route exports, installment notes, chat identification

## 1. Route students export (PDF + Excel)

In the route students window, both export buttons will produce a simpler sheet with only:  
Student name, Mother phone, Father phone, Emergency phone, Address and grade

- The on-screen table stays as it is (subscription type, Fawry code, map link remain visible).
- Emergency phone is added to the data fetch (currently not loaded).
- Row numbering kept as the first column for readability.

## 2. Note beside each installment (payment profile)

A note box already sits next to every installment in a customer's payment plan, but it only appears while a row is being edited or when a note already exists. Change so that:

- Finance, customer service and admins always see an editable note box on every installment row, with no need to enter edit mode.
- Saving happens when leaving the box (or pressing Enter); the writer's name and time show underneath.
- The existing "solved / reopen" behaviour stays unchanged.

## 3. Show student name and phone in chat

In the support chat used by customer service and in the driver/supervisor chat:

- Under the parent's name in the conversation list, show the student name(s) and the parent's phone number.
- Show the same details in the header of the open conversation.
- Search keeps working by parent name, phone, or student name.

## Technical notes

- `src/components/routes/RouteStudentsDialog.tsx`: add `emergency_phone` to the `parent_accounts` select, and change `HEADERS`/`toArray()` (and PDF column widths) to the 5 requested fields only.
- `src/components/payments/PaymentProfileDialog.tsx`: always render the inline note editor (currently gated behind `isEditing` / existing note) for users passing `useCanEditPaymentNotes()`; keep `savePaymentNote` RPC.
- `src/pages/SupportChat.tsx`: extend the conversation query to pull the parent's students and phone (via `parent_accounts` -> `registrations(student_name, status)`), store as `subtitle`/`meta`, render in the list row and header. Same for `src/components/chat/CustomerChatSection.tsx` and `src/components/chat/DriverChatSection.tsx` participant labels.
- No database changes required.