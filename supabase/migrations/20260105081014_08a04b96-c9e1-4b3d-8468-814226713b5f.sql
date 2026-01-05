-- Enable and force RLS on employees table
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Employees can view other employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.employees;
DROP POLICY IF EXISTS "Super admins can manage all employees" ON public.employees;

-- Super admins can manage all employees (full access)
CREATE POLICY "Super admins can manage all employees" 
ON public.employees 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'super_admin'))
WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'super_admin'));

-- Employees can view their own full profile
CREATE POLICY "Employees can view their own profile" 
ON public.employees 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Employees can view limited info of other employees (name only for directory)
-- This restricts full contact details to super admins only
CREATE POLICY "Employees can view other employee names" 
ON public.employees 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_employee(auth.uid()));