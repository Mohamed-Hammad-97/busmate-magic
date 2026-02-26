
-- Companies table (B2B clients)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  location_address text,
  latitude double precision,
  longitude double precision,
  contact_person_name text NOT NULL,
  contact_person_phone text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operation companies can manage companies" ON public.companies
  FOR ALL USING (has_department(auth.uid(), 'operation_companies'::department))
  WITH CHECK (has_department(auth.uid(), 'operation_companies'::department));

CREATE POLICY "Super admins can manage companies" ON public.companies
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Company lines table
CREATE TABLE public.company_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  number_of_shifts integer NOT NULL DEFAULT 1,
  shift_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_details text,
  price_per_shift numeric NOT NULL DEFAULT 0,
  driver_id uuid REFERENCES public.drivers(id),
  supervisor_id uuid REFERENCES public.supervisors(id),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operation companies can manage lines" ON public.company_lines
  FOR ALL USING (has_department(auth.uid(), 'operation_companies'::department))
  WITH CHECK (has_department(auth.uid(), 'operation_companies'::department));

CREATE POLICY "Super admins can manage lines" ON public.company_lines
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Finance can view lines" ON public.company_lines
  FOR SELECT USING (has_department(auth.uid(), 'finance'::department));

-- Driver attendance for corporate
CREATE TABLE public.corporate_driver_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_line_id uuid NOT NULL REFERENCES public.company_lines(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id),
  supervisor_id uuid REFERENCES public.supervisors(id),
  attendance_date date NOT NULL,
  shift_number integer NOT NULL DEFAULT 1,
  shift_rate numeric NOT NULL DEFAULT 0,
  is_present boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corporate_driver_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operation companies can manage attendance" ON public.corporate_driver_attendance
  FOR ALL USING (has_department(auth.uid(), 'operation_companies'::department))
  WITH CHECK (has_department(auth.uid(), 'operation_companies'::department));

CREATE POLICY "Super admins can manage attendance" ON public.corporate_driver_attendance
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Finance can view attendance" ON public.corporate_driver_attendance
  FOR SELECT USING (has_department(auth.uid(), 'finance'::department));

-- Driver bank details and documents
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id),
  supervisor_id uuid REFERENCES public.supervisors(id),
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_iban text,
  id_document_url text,
  license_document_url text,
  contract_document_url text,
  other_documents_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_profiles_person_check CHECK (driver_id IS NOT NULL OR supervisor_id IS NOT NULL)
);

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operation companies can manage staff profiles" ON public.staff_profiles
  FOR ALL USING (has_department(auth.uid(), 'operation_companies'::department))
  WITH CHECK (has_department(auth.uid(), 'operation_companies'::department));

CREATE POLICY "Operations can manage staff profiles" ON public.staff_profiles
  FOR ALL USING (has_department(auth.uid(), 'operations'::department))
  WITH CHECK (has_department(auth.uid(), 'operations'::department));

CREATE POLICY "Super admins can manage staff profiles" ON public.staff_profiles
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Finance can view staff profiles" ON public.staff_profiles
  FOR SELECT USING (has_department(auth.uid(), 'finance'::department));

-- Salary payments tracking
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id),
  supervisor_id uuid REFERENCES public.supervisors(id),
  amount numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date,
  transfer_reference text,
  reference_document_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_payments_person_check CHECK (driver_id IS NOT NULL OR supervisor_id IS NOT NULL)
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can manage salary payments" ON public.salary_payments
  FOR ALL USING (has_department(auth.uid(), 'finance'::department))
  WITH CHECK (has_department(auth.uid(), 'finance'::department));

CREATE POLICY "Super admins can manage salary payments" ON public.salary_payments
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Operation companies can view salary payments" ON public.salary_payments
  FOR SELECT USING (has_department(auth.uid(), 'operation_companies'::department));

-- Company invoices
CREATE TABLE public.company_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  invoice_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  issued_date date,
  paid_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can manage invoices" ON public.company_invoices
  FOR ALL USING (has_department(auth.uid(), 'finance'::department))
  WITH CHECK (has_department(auth.uid(), 'finance'::department));

CREATE POLICY "Super admins can manage invoices" ON public.company_invoices
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Operation companies can view invoices" ON public.company_invoices
  FOR SELECT USING (has_department(auth.uid(), 'operation_companies'::department));

-- Triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_lines_updated_at BEFORE UPDATE ON public.company_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salary_payments_updated_at BEFORE UPDATE ON public.salary_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_invoices_updated_at BEFORE UPDATE ON public.company_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for staff documents
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-documents', 'staff-documents', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Employees can upload staff documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'staff-documents' AND auth.uid() IS NOT NULL AND is_employee(auth.uid()));

CREATE POLICY "Employees can view staff documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'staff-documents' AND auth.uid() IS NOT NULL AND is_employee(auth.uid()));
