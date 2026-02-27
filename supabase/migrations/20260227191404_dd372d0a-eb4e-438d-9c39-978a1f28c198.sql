ALTER TABLE public.corporate_driver_attendance 
  ADD COLUMN extra_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN extra_fee_reason text;