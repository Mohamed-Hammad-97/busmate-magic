
-- Company employees table for registration form submissions
CREATE TABLE public.company_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_line_id uuid REFERENCES public.company_lines(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  national_id text,
  department text,
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;

-- Service role only (accessed via edge functions)
CREATE POLICY "Service role full access on company_employees"
  ON public.company_employees FOR ALL
  USING (false)
  WITH CHECK (false);

-- Allow public inserts for the registration form (via edge function)
-- Data access is handled entirely through edge functions with company JWT auth
