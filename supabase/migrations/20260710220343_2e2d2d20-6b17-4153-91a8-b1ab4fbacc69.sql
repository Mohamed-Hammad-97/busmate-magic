ALTER TABLE public.parent_accounts ADD COLUMN IF NOT EXISTS payment_phone TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS comments TEXT;