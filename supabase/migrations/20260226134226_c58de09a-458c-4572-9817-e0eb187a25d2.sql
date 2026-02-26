
-- Add operation_companies to department enum (must be committed separately)
ALTER TYPE public.department ADD VALUE IF NOT EXISTS 'operation_companies';
