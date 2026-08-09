ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS finance_seen_at timestamptz;
-- Mark all existing subscriptions as already seen so only future ones show as new
UPDATE public.subscriptions SET finance_seen_at = now() WHERE finance_seen_at IS NULL;