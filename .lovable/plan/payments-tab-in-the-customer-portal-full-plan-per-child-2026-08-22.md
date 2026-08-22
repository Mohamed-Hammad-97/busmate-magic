# Payments tab in the customer portal: full plan per child

## What happens today
The parent portal already lists a card per child and opens a dialog with the installments, but the plan never loads: the database only allows employees to read subscription records, so parents get an empty plan and the cards show no installments at all. Fawry reference codes are also not shown anywhere to the parent.

## What will change

1. **Let parents read their own subscription plans**
   Add a read rule so a parent can see the subscription rows that belong to their own children (installments are already readable by parents). Employees keep full access; nothing else changes.

2. **Payments tab: one record per child**
   Each child gets a card showing the plan type, total value, paid vs remaining amount, and progress. Children whose registration is cancelled or archived are not listed. A card with no activated plan yet shows "لم يتم تفعيل خطة الدفع بعد" instead of being silently empty.

3. **Child detail dialog = the finance payment profile, read-only**
   Clicking a child opens the full plan exactly as finance stored it:
   - Insurance row (installment 0) labelled التأمين, then القسط الأول، الثاني… in order
   - Amount, due date, paid date
   - Status badge: مدفوع / قيد الانتظار / متأخر (overdue computed the same way as the finance tab: unpaid and due date in the past)
   - Any extra fees attached to an installment
   - Receipt preview button when a receipt exists (already working)
   - **كود فوري** shown beside the installment whenever finance has entered a reference code, with a copy button, plus the finance note if present
   - Summary header: total, paid, remaining

4. **Live update when finance enters a code or marks paid**
   The portal subscribes to changes on the payments table for the parent's own installments, so a newly entered Fawry code or a status change appears without a refresh.

## Technical notes
- Migration: `CREATE POLICY "Parents can view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (registration_id IN (SELECT id FROM registrations WHERE parent_id IN (SELECT get_user_parent_ids(auth.uid()))))` plus `GRANT SELECT ON public.subscriptions TO authenticated` if not already present.
- `src/pages/ParentDashboard.tsx`: extend the registrations query to select `fawry_reference_code, fawry_note, fawry_cleared, payment_extra_fees(*)` on payments; filter out `cancelled`/`archived` registrations in the payments tab; rework the payment dialog body (installment 0 → التأمين, overdue derived from due_date, Fawry code row).
- Realtime: `supabase.channel('parent-payments')` on `postgres_changes` for `payments`, invalidating `["parent-registrations", parentAccount.id]`.
- No changes to the finance side.
