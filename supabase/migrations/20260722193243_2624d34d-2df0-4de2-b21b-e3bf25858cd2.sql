ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_note text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_by uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_by_name text;