CREATE TABLE public.other_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  parent_name text NOT NULL,
  national_id text,
  father_phone text NOT NULL,
  mother_phone text,
  emergency_phone text NOT NULL,
  payment_phone text,
  job text,
  city text NOT NULL,
  comments text,
  pickup_latitude double precision NOT NULL,
  pickup_longitude double precision NOT NULL,
  pickup_address text NOT NULL,
  school_name text NOT NULL,
  school_address text,
  school_latitude double precision,
  school_longitude double precision,
  grade text NOT NULL,
  car_type car_type NOT NULL DEFAULT 'ac',
  education_department education_department NOT NULL DEFAULT 'national',
  status text NOT NULL DEFAULT 'pending',
  converted_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  processed_by uuid,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_registrations TO authenticated;
GRANT ALL ON public.other_registrations TO service_role;

ALTER TABLE public.other_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view other registrations"
ON public.other_registrations FOR SELECT TO authenticated
USING (public.has_department(auth.uid(), 'customer_support') OR public.has_department(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can insert other registrations"
ON public.other_registrations FOR INSERT TO authenticated
WITH CHECK (public.has_department(auth.uid(), 'customer_support') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can update other registrations"
ON public.other_registrations FOR UPDATE TO authenticated
USING (public.has_department(auth.uid(), 'customer_support') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_department(auth.uid(), 'customer_support') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete other registrations"
ON public.other_registrations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_other_registrations_updated_at
BEFORE UPDATE ON public.other_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();