-- Add city column to drivers table
ALTER TABLE public.drivers 
ADD COLUMN city text NOT NULL DEFAULT 'Cairo';

-- Add city column to supervisors table
ALTER TABLE public.supervisors 
ADD COLUMN city text NOT NULL DEFAULT 'Cairo';