-- Phase 1: Authentication & Roles System

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'employee');

-- Create enum for departments
CREATE TYPE public.department AS ENUM ('customer_support', 'operations', 'finance', 'reports');

-- Create enum for education departments
CREATE TYPE public.education_department AS ENUM ('national', 'ig', 'american');

-- Create enum for car types
CREATE TYPE public.car_type AS ENUM ('ac', 'non_ac');

-- Create enum for subscription types
CREATE TYPE public.subscription_type AS ENUM ('monthly', 'yearly');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'overdue');

-- Create enum for registration status
CREATE TYPE public.registration_status AS ENUM ('pending_fees', 'complete', 'cancelled');

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Employee profiles table
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    departments department[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Schools table (Operations manages this)
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Parent accounts table
CREATE TABLE public.parent_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    parent_name TEXT NOT NULL,
    job TEXT,
    national_id TEXT NOT NULL,
    father_phone TEXT NOT NULL,
    mother_phone TEXT,
    emergency_phone TEXT NOT NULL,
    city TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Registrations table (children linked to parent)
CREATE TABLE public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.parent_accounts(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE RESTRICT NOT NULL,
    grade TEXT NOT NULL,
    education_department education_department NOT NULL,
    car_type car_type NOT NULL,
    status registration_status NOT NULL DEFAULT 'pending_fees',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subscriptions table (fees - employee only)
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    subscription_type subscription_type NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    number_of_installments INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drivers table
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    documents_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supervisors table
CREATE TABLE public.supervisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    documents_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Routes table
CREATE TABLE public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE RESTRICT NOT NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES public.supervisors(id) ON DELETE SET NULL,
    car_type car_type NOT NULL,
    max_seats INTEGER NOT NULL,
    route_duration_minutes INTEGER,
    route_data JSONB, -- Stores the route geometry
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Route assignments (students to routes)
CREATE TABLE public.route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE NOT NULL,
    pickup_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (route_id, registration_id)
);

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status payment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trip logs table
CREATE TABLE public.trip_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    trip_date DATE NOT NULL,
    departure_time TIME,
    arrival_time TIME,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attendance records
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_log_id UUID REFERENCES public.trip_logs(id) ON DELETE CASCADE NOT NULL,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE NOT NULL,
    present BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Incident reports
CREATE TABLE public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_log_id UUID REFERENCES public.trip_logs(id) ON DELETE CASCADE,
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES auth.users(id),
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customer feedback table
CREATE TABLE public.customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_from_parent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any employee role
CREATE OR REPLACE FUNCTION public.is_employee(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Function to check if user has specific department access
CREATE OR REPLACE FUNCTION public.has_department(_user_id UUID, _department department)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = _user_id
      AND _department = ANY(departments)
  ) OR public.has_role(_user_id, 'super_admin')
$$;

-- Function to get user departments
CREATE OR REPLACE FUNCTION public.get_user_departments(_user_id UUID)
RETURNS department[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT departments FROM public.employees WHERE user_id = _user_id),
    '{}'::department[]
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for employees
CREATE POLICY "Super admins can manage all employees"
ON public.employees
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can view their own profile"
ON public.employees
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Employees can view other employees"
ON public.employees
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for schools (Operations can manage, all authenticated can view)
CREATE POLICY "Operations can manage schools"
ON public.schools
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'operations'))
WITH CHECK (public.has_department(auth.uid(), 'operations'));

CREATE POLICY "All authenticated can view active schools"
ON public.schools
FOR SELECT
TO authenticated
USING (is_active = true);

-- Public can view active schools for registration
CREATE POLICY "Public can view active schools"
ON public.schools
FOR SELECT
TO anon
USING (is_active = true);

-- RLS Policies for parent_accounts
CREATE POLICY "Parents can view own account"
ON public.parent_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Parents can update own account"
ON public.parent_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Employees can view all parent accounts"
ON public.parent_accounts
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Customer support can manage parent accounts"
ON public.parent_accounts
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'customer_support'))
WITH CHECK (public.has_department(auth.uid(), 'customer_support'));

CREATE POLICY "Allow parent account creation"
ON public.parent_accounts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for registrations
CREATE POLICY "Employees can view all registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Customer support can manage registrations"
ON public.registrations
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'customer_support'))
WITH CHECK (public.has_department(auth.uid(), 'customer_support'));

CREATE POLICY "Parents can view own registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (
  parent_id IN (SELECT id FROM public.parent_accounts WHERE user_id = auth.uid())
);

CREATE POLICY "Allow registration creation"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for subscriptions (only employees can see/manage)
CREATE POLICY "Employees can view subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Customer support and finance can manage subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  public.has_department(auth.uid(), 'customer_support') OR 
  public.has_department(auth.uid(), 'finance')
)
WITH CHECK (
  public.has_department(auth.uid(), 'customer_support') OR 
  public.has_department(auth.uid(), 'finance')
);

-- RLS Policies for drivers
CREATE POLICY "Operations can manage drivers"
ON public.drivers
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'operations'))
WITH CHECK (public.has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for supervisors
CREATE POLICY "Operations can manage supervisors"
ON public.supervisors
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'operations'))
WITH CHECK (public.has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view supervisors"
ON public.supervisors
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for routes
CREATE POLICY "Operations can manage routes"
ON public.routes
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'operations'))
WITH CHECK (public.has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view routes"
ON public.routes
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Parents can view their routes"
ON public.routes
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ra.route_id FROM public.route_assignments ra
    JOIN public.registrations r ON r.id = ra.registration_id
    JOIN public.parent_accounts pa ON pa.id = r.parent_id
    WHERE pa.user_id = auth.uid()
  )
);

-- RLS Policies for route_assignments
CREATE POLICY "Operations can manage route assignments"
ON public.route_assignments
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'operations'))
WITH CHECK (public.has_department(auth.uid(), 'operations'));

CREATE POLICY "Employees can view route assignments"
ON public.route_assignments
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for payments
CREATE POLICY "Finance can manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'finance'))
WITH CHECK (public.has_department(auth.uid(), 'finance'));

CREATE POLICY "Employees can view payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Parents can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  subscription_id IN (
    SELECT s.id FROM public.subscriptions s
    JOIN public.registrations r ON r.id = s.registration_id
    JOIN public.parent_accounts pa ON pa.id = r.parent_id
    WHERE pa.user_id = auth.uid()
  )
);

-- RLS Policies for trip_logs
CREATE POLICY "Operations and reports can manage trip logs"
ON public.trip_logs
FOR ALL
TO authenticated
USING (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
)
WITH CHECK (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
);

CREATE POLICY "Employees can view trip logs"
ON public.trip_logs
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for attendance
CREATE POLICY "Operations and reports can manage attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
)
WITH CHECK (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
);

CREATE POLICY "Employees can view attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for incident_reports
CREATE POLICY "Operations and reports can manage incidents"
ON public.incident_reports
FOR ALL
TO authenticated
USING (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
)
WITH CHECK (
  public.has_department(auth.uid(), 'operations') OR 
  public.has_department(auth.uid(), 'reports')
);

CREATE POLICY "Employees can view incidents"
ON public.incident_reports
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

-- RLS Policies for customer_feedback
CREATE POLICY "Customer support can manage feedback"
ON public.customer_feedback
FOR ALL
TO authenticated
USING (public.has_department(auth.uid(), 'customer_support'))
WITH CHECK (public.has_department(auth.uid(), 'customer_support'));

CREATE POLICY "Employees can view feedback"
ON public.customer_feedback
FOR SELECT
TO authenticated
USING (public.is_employee(auth.uid()));

CREATE POLICY "Parents can add and view own feedback"
ON public.customer_feedback
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT r.id FROM public.registrations r
    JOIN public.parent_accounts pa ON pa.id = r.parent_id
    WHERE pa.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert feedback"
ON public.customer_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  registration_id IN (
    SELECT r.id FROM public.registrations r
    JOIN public.parent_accounts pa ON pa.id = r.parent_id
    WHERE pa.user_id = auth.uid()
  ) AND is_from_parent = true
);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply update triggers
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parent_accounts_updated_at
    BEFORE UPDATE ON public.parent_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at
    BEFORE UPDATE ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supervisors_updated_at
    BEFORE UPDATE ON public.supervisors
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incident_reports_updated_at
    BEFORE UPDATE ON public.incident_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();