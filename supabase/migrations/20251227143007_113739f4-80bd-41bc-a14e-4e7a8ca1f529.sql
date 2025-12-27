-- Add student_name column to registrations table
ALTER TABLE public.registrations 
ADD COLUMN student_name text NOT NULL DEFAULT '';