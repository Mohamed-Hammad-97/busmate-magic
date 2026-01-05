-- Ensure RLS is enabled on registrations table (reinforce)
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (prevents bypassing)
ALTER TABLE public.registrations FORCE ROW LEVEL SECURITY;

-- Drop and recreate all SELECT policies with explicit auth checks
DROP POLICY IF EXISTS "Employees can view all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Parents can view own registrations" ON public.registrations;
DROP POLICY IF EXISTS "Customer support can manage registrations" ON public.registrations;

-- Recreate with explicit authentication requirement
CREATE POLICY "Customer support can manage registrations" 
ON public.registrations 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'customer_support'))
WITH CHECK (auth.uid() IS NOT NULL AND has_department(auth.uid(), 'customer_support'));

CREATE POLICY "Employees can view all registrations" 
ON public.registrations 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_employee(auth.uid()));

CREATE POLICY "Parents can view own registrations" 
ON public.registrations 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND parent_id IN (
  SELECT parent_accounts.id
  FROM parent_accounts
  WHERE parent_accounts.user_id = auth.uid()
));