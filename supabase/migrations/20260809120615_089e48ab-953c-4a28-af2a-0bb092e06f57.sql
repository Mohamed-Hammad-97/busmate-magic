ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS fawry_reference_code text,
  ADD COLUMN IF NOT EXISTS fawry_note text,
  ADD COLUMN IF NOT EXISTS fawry_cleared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fawry_cleared_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS fawry_cleared_by uuid;