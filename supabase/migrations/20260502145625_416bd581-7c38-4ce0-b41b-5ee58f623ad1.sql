ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_color text;