-- Update registrations RLS policies to explicitly require authentication
-- Drop existing SELECT policies and recreate them with explicit auth check

DROP POLICY IF EXISTS "Employees can view all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Parents can view own registrations" ON public.registrations;

-- Recreate policies with explicit authentication requirement
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