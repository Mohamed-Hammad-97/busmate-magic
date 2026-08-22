# Fix: installments hidden as "archived" on an active subscription

## What's wrong

For يونس احمد حسين the subscription really does have 10 rows: the 200 EGP insurance plus 9 installments of 1,611.11 EGP. The nine installments are all stored with status **archived**, so the payment profile and payments tab only show the insurance line.

Cause: the registration was archived at some point (archiving also marks its pending installments as archived). Later the subscription was re-saved from the "Subscription & Fees" window. That save rebuilds every installment row but **copies the old status back**, so the archived status was carried over onto the fresh rows, while the newly added insurance row started clean and shows normally. The same save also sets the registration back to `complete` — which is why the record looks active but its installments do not.

Two subscriptions in the database are currently in this state (29 installment rows total).

## Fix

1. **Stop it happening again** — when the subscription window rebuilds installments, an old `archived` status is treated as `pending` (paid rows and their receipts/paid-by data stay untouched).
2. **Repair the existing data** — the installments of the affected subscriptions whose registration is not archived are set back to `pending`, keeping their amounts, dates, receipts and notes. Rows that were genuinely paid are left as-is.

After this, the profile shows Insurance + Installments 1..9, and totals/remaining recalculate correctly.

## Technical notes

- `src/components/registrations/SubscriptionDialog.tsx`: in `buildRow`, `status: prev?.status === 'archived' ? 'pending' : (prev?.status ?? 'pending')`.
- Data migration: `UPDATE public.payments p SET status='pending' FROM subscriptions s JOIN registrations r ON r.id=s.registration_id WHERE p.subscription_id=s.id AND p.status='archived' AND r.status <> 'archived';`
- No schema or RLS changes.
