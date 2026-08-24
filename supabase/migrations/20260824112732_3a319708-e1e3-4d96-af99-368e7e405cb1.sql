-- 1. School attendance
CREATE TABLE public.school_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('morning','return')),
  is_present boolean NOT NULL DEFAULT false,
  extra_deduction_amount numeric NOT NULL DEFAULT 0,
  extra_deduction_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX school_attendance_driver_unique ON public.school_attendance (route_id, driver_id, attendance_date, shift) WHERE driver_id IS NOT NULL;
CREATE UNIQUE INDEX school_attendance_supervisor_unique ON public.school_attendance (route_id, supervisor_id, attendance_date, shift) WHERE supervisor_id IS NOT NULL;
CREATE INDEX school_attendance_date_idx ON public.school_attendance (attendance_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_attendance TO authenticated;
GRANT ALL ON public.school_attendance TO service_role;
ALTER TABLE public.school_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view school attendance" ON public.school_attendance FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Staff can manage school attendance" ON public.school_attendance FOR ALL TO authenticated USING (public.is_employee(auth.uid())) WITH CHECK (public.is_employee(auth.uid()));
CREATE TRIGGER update_school_attendance_updated_at BEFORE UPDATE ON public.school_attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Staff advances
CREATE TABLE public.staff_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_advances_date_idx ON public.staff_advances (advance_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_advances TO authenticated;
GRANT ALL ON public.staff_advances TO service_role;
ALTER TABLE public.staff_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view advances" ON public.staff_advances FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Staff can manage advances" ON public.staff_advances FOR ALL TO authenticated USING (public.is_employee(auth.uid())) WITH CHECK (public.is_employee(auth.uid()));
CREATE TRIGGER update_staff_advances_updated_at BEFORE UPDATE ON public.staff_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Staff coverage
CREATE TABLE public.staff_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_date date NOT NULL DEFAULT CURRENT_DATE,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  covered_driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  covered_supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  covering_driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  covering_supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_coverage_date_idx ON public.staff_coverage (coverage_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_coverage TO authenticated;
GRANT ALL ON public.staff_coverage TO service_role;
ALTER TABLE public.staff_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view coverage" ON public.staff_coverage FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Staff can manage coverage" ON public.staff_coverage FOR ALL TO authenticated USING (public.is_employee(auth.uid())) WITH CHECK (public.is_employee(auth.uid()));
CREATE TRIGGER update_staff_coverage_updated_at BEFORE UPDATE ON public.staff_coverage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Monthly salaries
CREATE TABLE public.staff_monthly_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  month date NOT NULL,
  monthly_cost numeric NOT NULL DEFAULT 0,
  absence_deduction_override numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_monthly_salaries_driver_unique ON public.staff_monthly_salaries (driver_id, month) WHERE driver_id IS NOT NULL;
CREATE UNIQUE INDEX staff_monthly_salaries_supervisor_unique ON public.staff_monthly_salaries (supervisor_id, month) WHERE supervisor_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_monthly_salaries TO authenticated;
GRANT ALL ON public.staff_monthly_salaries TO service_role;
ALTER TABLE public.staff_monthly_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view monthly salaries" ON public.staff_monthly_salaries FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Staff can manage monthly salaries" ON public.staff_monthly_salaries FOR ALL TO authenticated USING (public.is_employee(auth.uid())) WITH CHECK (public.is_employee(auth.uid()));
CREATE TRIGGER update_staff_monthly_salaries_updated_at BEFORE UPDATE ON public.staff_monthly_salaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();