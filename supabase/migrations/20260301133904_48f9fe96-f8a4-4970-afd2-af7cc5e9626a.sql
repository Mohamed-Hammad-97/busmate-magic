
-- Company portal accounts (supervisors and employees created by supervisors)
CREATE TABLE public.company_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'admin', -- 'admin' = company supervisor, 'employee' = company staff
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.company_accounts ENABLE ROW LEVEL SECURITY;

-- Seater employees (operation_companies + super_admin) can manage all company accounts
CREATE POLICY "Operation companies can manage company accounts"
  ON public.company_accounts FOR ALL
  USING (has_department(auth.uid(), 'operation_companies'::department))
  WITH CHECK (has_department(auth.uid(), 'operation_companies'::department));

CREATE POLICY "Super admins can manage company accounts"
  ON public.company_accounts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add comment/approval fields to company_invoices
ALTER TABLE public.company_invoices 
  ADD COLUMN IF NOT EXISTS company_comment text,
  ADD COLUMN IF NOT EXISTS company_approved_by uuid REFERENCES public.company_accounts(id),
  ADD COLUMN IF NOT EXISTS company_approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS company_approved_at timestamptz;
